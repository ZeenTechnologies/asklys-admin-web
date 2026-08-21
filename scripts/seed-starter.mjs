// Reset the database to a clean launch state:  node scripts/seed-starter.mjs
// WIPES posts, traffic, subscribers, backlinks and social, then imports the nine
// starter articles from db/seed as published posts. No fake traffic, no invented
// subscribers — the numbers start at zero, which is what you want on launch day.
// Run scripts/backfill-embeddings.mjs afterwards so "related reading" works.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, exit } from "node:process";
import pg from "pg";
import matter from "gray-matter";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with it in the environment, e.g.\n" +
                "  DATABASE_URL=postgresql://... node scripts/seed-starter.mjs");
  exit(1);
}

// This deletes live content, so make the target explicit before doing it.
const target = DATABASE_URL.replace(/:\/\/[^@]*@/, "://***@");
const rl = createInterface({ input: stdin, output: stdout });
const answer = await rl.question(`This WIPES every table in:\n  ${target}\nType "wipe" to continue: `);
rl.close();
if (answer.trim() !== "wipe") {
  console.log("Cancelled.");
  exit(0);
}

const SEED_DIR = fileURLToPath(new URL("../db/seed/", import.meta.url));
const files = readdirSync(SEED_DIR).filter((f) => f.endsWith(".md")).sort();
if (!files.length) {
  console.error(`No markdown found in ${SEED_DIR}`);
  exit(1);
}

const WORDS_PER_MIN = 220;

const rows = files.map((file) => {
  const { data, content } = matter(readFileSync(join(SEED_DIR, file), "utf8"));
  const words = content.trim().split(/\s+/).length;
  return {
    slug: file.replace(/\.md$/, ""),
    title: data.title ?? "Untitled",
    excerpt: data.excerpt ?? "",
    body_html: content.trim(),
    category: data.category ?? "screen-time",
    author: data.author ?? "The Ask Parent Team",
    post_type: data.category === "reviews" ? "comparison" : "article",
    card_style: data.featured ? "hero" : "standard",
    font_style: "default",
    cover_image: data.image ?? "",
    cover_alt: data.imageAlt ?? data.title ?? "",
    featured: Boolean(data.featured),
    status: "published",
    published_at: new Date(data.date ?? Date.now()).toISOString(),
    read_mins: data.readMins ?? Math.max(1, Math.round(words / WORDS_PER_MIN)),
    keywords: data.keywords ?? [],
    tags: data.tags ?? [],
    faq: JSON.stringify(data.faq ?? []),
  };
});

// Exactly ONE post is the homepage hero. The markdown can flag several (or none);
// the homepage only renders the first, so make the data honest.
let heroTaken = false;
for (const r of rows) {
  if (r.featured && !heroTaken) {
    heroTaken = true;
    r.card_style = "hero";
  } else {
    r.featured = false;
    if (r.card_style === "hero") r.card_style = "standard";
  }
}
if (!heroTaken) {
  rows[0].featured = true;
  rows[0].card_style = "hero";
}

const COLS = Object.keys(rows[0]);

const db = new pg.Client({ connectionString: DATABASE_URL });
await db.connect();

try {
  // One transaction: a failure mid-import leaves the database as it was,
  // rather than wiped-and-empty.
  await db.query("BEGIN");

  console.log("Clearing every table...");
  for (const table of ["pageviews", "clicks", "citations", "backlinks", "social_posts", "subscribers", "posts"]) {
    const { rowCount } = await db.query(`DELETE FROM ${table}`);
    console.log(`  cleared  ${table} (${rowCount})`);
  }

  console.log(`\nImporting ${rows.length} starter articles...`);
  for (const r of rows) {
    await db.query(
      `INSERT INTO posts (${COLS.join(", ")})
       VALUES (${COLS.map((_, i) => `$${i + 1}`).join(", ")})`,
      COLS.map((c) => r[c]),
    );
    console.log(`  ${r.featured ? "*" : " "} ${r.slug}`);
  }

  await db.query("COMMIT");
  console.log(`\nDone. ${rows.length} published posts, zero traffic, zero subscribers.`);
  console.log("Next: node scripts/backfill-embeddings.mjs   (enables related reading)");
} catch (err) {
  await db.query("ROLLBACK").catch(() => {});
  if (err.code === "42P01") {
    console.error("A table is missing — run the migrations in db/ first.");
  } else {
    console.error(err.message);
  }
  exit(1);
} finally {
  await db.end();
}
