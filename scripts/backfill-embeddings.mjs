// Generate embeddings for posts that don't have one:  node scripts/backfill-embeddings.mjs
// Run after any bulk import — "related reading" on the site falls back to a
// same-category match for posts with no embedding.
import { exit } from "node:process";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  exit(1);
}
if (!GEMINI_KEY) {
  console.error("GEMINI_API_KEY is not set — cannot generate embeddings.");
  exit(1);
}

const EMBED_MODEL = "gemini-embedding-001";
const DIMS = 768; // must match vector(768) in the schema

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function embed(text) {
  // The free tier 503s under load; retry a couple of times before giving up.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text: text.slice(0, 8000) }] },
          outputDimensionality: DIMS,
        }),
      },
    );
    if (res.ok) return (await res.json()).embedding?.values ?? null;
    if ([429, 500, 503].includes(res.status) && attempt < 2) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    console.warn(`  embedding failed: ${res.status} ${(await res.text()).slice(0, 120)}`);
    return null;
  }
  return null;
}

const db = new pg.Client({ connectionString: DATABASE_URL });
await db.connect();

try {
  const { rows: posts } = await db.query(
    `SELECT id, slug, title, excerpt, body_html FROM posts WHERE embedding IS NULL`,
  );

  if (posts.length === 0) {
    console.log("Every post already has an embedding. Nothing to do.");
    exit(0);
  }

  console.log(`${posts.length} post(s) without an embedding.\n`);

  let done = 0;
  for (const p of posts) {
    const text = `${p.title}\n${p.excerpt ?? ""}\n${(p.body_html ?? "").slice(0, 4000)}`;
    const vector = await embed(text);

    if (!vector?.length) {
      console.log(`  x ${p.slug}`);
      continue;
    }

    // pgvector takes the "[0.1,0.2]" string form, not a JS array.
    await db.query(`UPDATE posts SET embedding = $1::vector WHERE id = $2`,
      [`[${vector.join(",")}]`, p.id]);

    done++;
    console.log(`  ok ${p.slug}`);
    await sleep(250); // stay well inside the free-tier rate limit
  }

  console.log(`\nEmbedded ${done}/${posts.length}. Related-posts recommendations are now semantic.`);
} catch (err) {
  if (err.code === "42P01") console.error("The posts table doesn't exist — run the migrations in db/ first.");
  else console.error(err.message);
  exit(1);
} finally {
  await db.end();
}
