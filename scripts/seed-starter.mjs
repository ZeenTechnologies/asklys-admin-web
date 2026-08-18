/**
 * Reset the database to a clean launch state.
 *
 *   node scripts/seed-starter.mjs
 *
 * WIPES every table (posts, traffic, subscribers, backlinks, social) and then
 * imports the nine real starter articles from the blog's markdown as published
 * posts. No fake traffic, no invented subscribers — the numbers start at zero,
 * which is what you want the day you launch.
 *
 * Run scripts/backfill-embeddings.mjs afterwards so "related reading" works.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import matter from "../../pv-blog/node_modules/gray-matter/index.js";

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
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

const ALL = "id=neq.00000000-0000-0000-0000-000000000000";
const NUM = "id=gt.0";

// ---------------------------------------------------------------- wipe
console.log("Clearing every table…");
for (const [table, filter] of [
  ["pageviews", NUM],
  ["clicks", NUM],
  ["citations", ALL],
  ["backlinks", ALL],
  ["social_posts", ALL],
  ["subscribers", ALL],
  ["posts", ALL],
]) {
  const r = await fetch(`${SB}/${table}?${filter}`, { method: "DELETE", headers: H });
  console.log(`  ${r.ok ? "cleared" : "skipped"}  ${table}${r.ok ? "" : ` (${r.status})`}`);
}

// ------------------------------------------------------------- import
const DIR = new URL("../../pv-blog/src/content/posts/", import.meta.url).pathname.replace(/^\//, "");
const files = readdirSync(DIR).filter((f) => f.endsWith(".md"));
console.log(`\nImporting ${files.length} starter articles…`);

const WORDS_PER_MIN = 220;
const rows = files.map((file) => {
  const { data, content } = matter(readFileSync(join(DIR, file), "utf8"));
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
    faq: data.faq ?? [],
  };
});

// Exactly ONE post is the homepage hero. The markdown can flag several (or
// none); the homepage only ever renders the first, so make the data honest.
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

const res = await fetch(`${SB}/posts`, { method: "POST", headers: H, body: JSON.stringify(rows) });
if (!res.ok) {
  console.error("Insert failed:", res.status, (await res.text()).slice(0, 300));
  process.exit(1);
}

for (const r of rows) console.log(`  ${r.featured ? "★" : " "} ${r.slug}`);
console.log(`\nDone. ${rows.length} published posts, zero traffic, zero subscribers.`);
console.log("Next: node scripts/backfill-embeddings.mjs   (enables related reading)");
