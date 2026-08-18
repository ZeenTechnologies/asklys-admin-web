/**
 * Generate embeddings for any post that doesn't have one.
 *
 *   node scripts/backfill-embeddings.mjs
 *
 * Posts saved through the admin get an embedding automatically. Anything that
 * reached the database another way — the demo seeder, a bulk import, or a post
 * written before this feature existed — needs this. Embeddings power the blog's
 * "related reading" recommendations.
 *
 * Safe to re-run: it only touches rows where embedding is null.
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const SB = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = env.GEMINI_API_KEY;
const EMBED_MODEL = "gemini-embedding-001";
const DIMS = 768; // must match vector(768) in the schema

if (!GEMINI_KEY) {
  console.error("GEMINI_API_KEY missing from .env.local — cannot generate embeddings.");
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function embed(text) {
  // free tier 503s under load; retry a couple of times before giving up
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

const res = await fetch(
  `${SB}/posts?select=id,slug,title,excerpt,body_html&embedding=is.null`,
  { headers: H },
);
if (!res.ok) {
  console.error("Could not read posts:", res.status, await res.text());
  process.exit(1);
}

const posts = await res.json();
if (posts.length === 0) {
  console.log("Every post already has an embedding. Nothing to do.");
  process.exit(0);
}

console.log(`${posts.length} post(s) without an embedding.\n`);

let done = 0;
for (const p of posts) {
  const text = `${p.title}\n${p.excerpt ?? ""}\n${(p.body_html ?? "").slice(0, 4000)}`;
  const vector = await embed(text);
  if (!vector?.length) {
    console.log(`  ✗ ${p.slug}`);
    continue;
  }
  const up = await fetch(`${SB}/posts?id=eq.${p.id}`, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=minimal" },
    body: JSON.stringify({ embedding: vector }),
  });
  if (up.ok) {
    done++;
    console.log(`  ✓ ${p.slug}`);
  } else {
    console.log(`  ✗ ${p.slug} — ${up.status} ${(await up.text()).slice(0, 100)}`);
  }
  await sleep(250); // stay well inside the free-tier rate limit
}

console.log(`\nEmbedded ${done}/${posts.length}. Related-posts recommendations are now semantic.`);
