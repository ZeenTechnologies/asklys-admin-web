/**
 * Seed realistic DEMO data for showing the dashboard.
 *
 *   node scripts/seed-demo.mjs          -> insert demo posts + 30 days of traffic
 *   node scripts/seed-demo.mjs --clear  -> remove everything again
 *
 * This is fake data for demonstration only. Run --clear before going live.
 */
import pg from "pg";


const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const db = new pg.Client({ connectionString: DATABASE_URL });
await db.connect();

// jsonb columns arrive as objects/arrays and must be sent as JSON text.
const encode = (v) => (v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v);

// Multi-row INSERT built from the first row's keys; every row must share a shape.
async function post(table, rows) {
  if (!rows.length) return { ok: true };
  const cols = Object.keys(rows[0]);
  const values = [];
  const tuples = rows.map((r, n) => {
    const ph = cols.map((_, i) => `$${n * cols.length + i + 1}`);
    values.push(...cols.map((c) => encode(r[c])));
    return `(${ph.join(", ")})`;
  });
  try {
    await db.query(`INSERT INTO ${table} (${cols.join(", ")}) VALUES ${tuples.join(", ")}`, values);
    return { ok: true };
  } catch (e) {
    return { ok: false, status: e.code, text: async () => e.message };
  }
}

const del = async (table) => {
  try { await db.query(`DELETE FROM ${table}`); } catch { /* table may not exist yet */ }
};

if (process.argv.includes("--clear")) {
  for (const t of ["pageviews", "clicks", "citations", "backlinks", "social_posts", "subscribers", "posts"]) {
    await del(t);
  }
  console.log("Demo data cleared.");
  await db.end();
  process.exit(0);
}

// ---------------------------------------------------------------- posts
// Weights sum to 1 and decide how much traffic each post gets; `conv` is its
// store-click rate. Two-plus posts per category so the homepage's category
// blocks (lead + list) have something to list.
const POSTS = [
  { slug: "how-to-block-tiktok-on-your-childs-phone", title: "How to Block TikTok on Your Child's Phone (Without Starting a War)", category: "apps-and-social", post_type: "how-to", weight: 0.170, conv: 0.052, featured: true },
  { slug: "best-parental-control-apps-2026", title: "Best Parental Control Apps of 2026: An Honest Comparison", category: "reviews", post_type: "comparison", weight: 0.135, conv: 0.081 },
  { slug: "how-much-screen-time-13-year-old", title: "How Much Screen Time Is Too Much for a 13-Year-Old?", category: "screen-time", post_type: "article", weight: 0.110, conv: 0.028 },
  { slug: "screen-time-rules-that-work", title: "7 Screen-Time Rules That Survive a Real Family", category: "family-life", post_type: "listicle", weight: 0.085, conv: 0.034 },
  { slug: "teen-phone-without-fighting", title: "How to Get Your Teen Off Their Phone Without a Fight", category: "parenting-teens", post_type: "article", weight: 0.075, conv: 0.041 },
  { slug: "instagram-settings-for-parents", title: "The Instagram Settings Every Parent Should Change Tonight", category: "digital-safety", post_type: "how-to", weight: 0.065, conv: 0.036 },
  { slug: "why-kids-cant-focus-homework", title: "Why Your Child Can't Focus on Homework (It Isn't Laziness)", category: "focus-and-school", post_type: "article", weight: 0.060, conv: 0.022 },
  { slug: "screen-time-rewards-earn-time", title: "The Case for Making Kids Earn Screen Time", category: "screen-time", post_type: "article", weight: 0.055, conv: 0.045 },
  { slug: "snapchat-safety-for-parents", title: "Snapchat for Parents: What the Settings Actually Do", category: "digital-safety", post_type: "how-to", weight: 0.050, conv: 0.039 },
  { slug: "first-phone-what-age", title: "What Age Should a Child Get Their First Phone?", category: "parenting-teens", post_type: "article", weight: 0.048, conv: 0.033 },
  { slug: "phones-and-sleep-bedtime", title: "Phones and Sleep: Why Bedtime Is the Rule Worth Winning", category: "family-life", post_type: "article", weight: 0.042, conv: 0.031 },
  { slug: "qustodio-vs-bark", title: "Qustodio vs Bark: Which One Fits Your Family?", category: "reviews", post_type: "comparison", weight: 0.040, conv: 0.074 },
  { slug: "notifications-and-attention", title: "How Many Notifications Does Your Child Get a Day? (It's Worse Than You Think)", category: "focus-and-school", post_type: "article", weight: 0.035, conv: 0.024 },
  { slug: "youtube-kids-settings", title: "YouTube's Parental Controls, Ranked by How Easily Kids Bypass Them", category: "apps-and-social", post_type: "listicle", weight: 0.030, conv: 0.047 },
];

const daysAgo = (d) => new Date(Date.now() - d * 864e5);

/**
 * Cover art.
 *
 * Real, on-topic Pexels photos when a PEXELS_API_KEY is available (it lives in
 * Desktop\Total\PV\.env, or set it in this app's .env.local) — one search per
 * post so the picture matches the headline. Falls back to Picsum so the seeder
 * still works with no key. Pexels photos are free for commercial use; credit is
 * appreciated but not required.
 */
const PEXELS_KEY = process.env.PEXELS_API_KEY ?? "";

// what to search Pexels for, per post
const PHOTO_QUERY = {
  "how-to-block-tiktok-on-your-childs-phone": "teenager using smartphone sofa",
  "best-parental-control-apps-2026": "parent and child looking at phone together",
  "how-much-screen-time-13-year-old": "teenage boy phone bedroom",
  "screen-time-rules-that-work": "family dinner table together",
  "teen-phone-without-fighting": "mother talking to teenage daughter",
  "instagram-settings-for-parents": "girl scrolling social media phone",
  "why-kids-cant-focus-homework": "child doing homework desk distracted",
  "screen-time-rewards-earn-time": "child playing puzzle game tablet",
  "snapchat-safety-for-parents": "teenagers taking selfie phone",
  "first-phone-what-age": "child holding first mobile phone",
  "phones-and-sleep-bedtime": "child sleeping bedroom night",
  "qustodio-vs-bark": "parent checking phone laptop desk",
  "notifications-and-attention": "smartphone notifications screen closeup",
  "youtube-kids-settings": "kids watching tablet video",
};

const picsum = (slug) => `https://picsum.photos/seed/${slug}/1200/675`;

async function findPhoto(slug) {
  const q = PHOTO_QUERY[slug];
  if (!PEXELS_KEY || !q) return { url: picsum(slug), alt: "" };
  try {
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=landscape&per_page=1`,
      { headers: { Authorization: PEXELS_KEY, "User-Agent": "Mozilla/5.0" } },
    );
    if (!r.ok) return { url: picsum(slug), alt: "" };
    const p = (await r.json()).photos?.[0];
    // 1200-wide crop, which is what the hero and cards actually render at
    return p
      ? { url: `${p.src.original}?auto=compress&cs=tinysrgb&w=1200&h=675&fit=crop`, alt: p.alt ?? "" }
      : { url: picsum(slug), alt: "" };
  } catch {
    return { url: picsum(slug), alt: "" };
  }
}

const EXCERPTS = {
  "how-to-block-tiktok-on-your-childs-phone":
    "Every built-in TikTok limit can be switched off by the child in under a minute. Here's what actually holds — and how to introduce it without a fight.",
  "best-parental-control-apps-2026":
    "We ran seven parental control apps on real family devices for six weeks. Most do one thing well and several things badly — here's which is which.",
  "how-much-screen-time-13-year-old":
    "There is no magic number, and the guidance that gets quoted most is older than TikTok. What the research actually supports, by age.",
  "screen-time-rules-that-work":
    "Rules fail because they're unenforceable, not because kids are difficult. Seven that survive a normal Tuesday evening.",
  "teen-phone-without-fighting":
    "Confiscation wins the evening and loses the year. What to do instead when your teenager won't put it down.",
  "instagram-settings-for-parents":
    "Six settings that meaningfully reduce risk, in the order worth doing them — and the two that do nothing at all.",
  "why-kids-cant-focus-homework":
    "A phone face-down on the desk still costs attention. What notification design does to a developing brain, and the fix that works.",
  "screen-time-rewards-earn-time":
    "Taking time away creates a losing battle. Letting kids earn it back changes who the opponent is.",
  "snapchat-safety-for-parents":
    "Disappearing messages, Snap Map, streaks. What each setting really controls, and which ones your child can turn back on.",
  "first-phone-what-age":
    "The honest answer isn't an age — it's a set of conditions. Here's the checklist worth using instead.",
  "phones-and-sleep-bedtime":
    "Of every rule you could enforce, this one has the strongest evidence and the biggest payoff. Start here.",
  "qustodio-vs-bark":
    "One watches content, one controls time. Picking the wrong one is why most parents give up in week two.",
  "notifications-and-attention":
    "The average teenager gets over 200 a day, most during school hours. What that does to focus, and the settings that help.",
  "youtube-kids-settings":
    "We tried to break every YouTube control with a 12-year-old's patience. Four held. Three didn't.",
};

// one Pexels lookup per post, in parallel
const photos = Object.fromEntries(
  await Promise.all(POSTS.map(async (p) => [p.slug, await findPhoto(p.slug)])),
);
console.log(
  PEXELS_KEY
    ? `Matched ${Object.values(photos).filter((x) => x.url.includes("pexels")).length}/${POSTS.length} cover photos from Pexels.`
    : "No PEXELS_API_KEY found — using Picsum placeholders for covers.",
);

await post(
  "posts",
  POSTS.map((p, i) => ({
    slug: p.slug,
    title: p.title,
    cover_image: photos[p.slug].url,
    cover_alt: photos[p.slug].alt || p.title,
    excerpt: EXCERPTS[p.slug] ?? "Practical, judgement-free guidance for parents — what actually works, and what doesn't.",
    body_html: `Most parents arrive here after trying the obvious things.\n\n## What actually works\n\nThe honest answer depends on which problem you have: safety, time, or conflict. They need different solutions.\n\n## Where to start\n\nProtect sleep first. A hard stop at bedtime is the easiest rule to enforce and the one that changes the most.`,
    category: p.category,
    post_type: p.post_type,
    card_style: p.featured ? "hero" : "standard",
    font_style: "default",
    featured: Boolean(p.featured),
    status: "published",
    published_at: daysAgo(30 - i * 3).toISOString(),
    read_mins: 6 + (i % 5),
    keywords: ["screen time", "parental controls"],
    tags: ["parenting"],
    faq: [],
  })),
);
console.log(`Inserted ${POSTS.length} demo posts.`);

// ---------------------------------------------------------------- traffic
// Weighted so the mix looks like a real UK/US parenting site.
const COUNTRIES = [
  ["US", 0.40], ["GB", 0.22], ["CA", 0.09], ["AU", 0.07], ["IE", 0.04],
  ["IN", 0.05], ["PK", 0.03], ["DE", 0.03], ["NL", 0.02], ["NZ", 0.02],
  ["ZA", 0.02], ["AE", 0.01],
];
const SOURCES = [
  ["google", 0.36], ["pinterest", 0.22], ["direct", 0.13],
  ["reddit", 0.09], ["referral", 0.08], ["x", 0.05], ["facebook", 0.04], ["bing", 0.03],
];

// Real parenting sites that would plausibly link to us. These become the
// "detected backlinks" the admin discovers from traffic.
const REFERRERS = [
  ["www.mumsnet.com/talk/parenting", 0.24],
  ["www.netmums.com/coffeehouse", 0.18],
  ["www.reddit.com/r/Parenting", 0.16],
  ["www.commonsensemedia.org/articles", 0.13],
  ["schoolgateway.blog", 0.11],
  ["www.parentingscience.com/links", 0.10],
  ["digitalparenting.substack.com", 0.08],
];
const DEVICES = [["mobile", 0.66], ["desktop", 0.28], ["tablet", 0.06]];
const BROWSERS = [["Chrome", 0.55], ["Safari", 0.30], ["Edge", 0.09], ["Firefox", 0.06]];

const pick = (table) => {
  let r = Math.random();
  for (const [v, w] of table) {
    if ((r -= w) <= 0) return v;
  }
  return table[0][0];
};
const pickPost = () => {
  let r = Math.random();
  for (const p of POSTS) {
    if ((r -= p.weight) <= 0) return p;
  }
  return POSTS[0];
};

const views = [];
const clicks = [];
const DAYS = 30;

for (let d = DAYS - 1; d >= 0; d--) {
  // gentle growth + weekend dip, so the chart looks like real life
  const dow = daysAgo(d).getDay();
  const weekend = dow === 0 || dow === 6 ? 0.75 : 1;
  const growth = 0.35 + ((DAYS - d) / DAYS) * 1.5;
  const count = Math.round((26 + Math.random() * 22) * growth * weekend);

  for (let i = 0; i < count; i++) {
    const p = pickPost();
    const country = pick(COUNTRIES);
    const source = pick(SOURCES);
    const when = daysAgo(d);
    when.setHours(6 + Math.floor(Math.random() * 17), Math.floor(Math.random() * 60));
    const visitor = `demo${Math.floor(Math.random() * 900)}${d}`;
    const session = `s${Math.floor(Math.random() * 9999)}`;

    // "referral" traffic carries a real third-party URL — that's what makes a
    // backlink discoverable in the admin.
    const referrer =
      source === "direct" ? null
      : source === "referral" ? `https://${pick(REFERRERS)}`
      : `https://${source}.com/`;

    views.push({
      path: `/blog/${p.slug}`,
      post_slug: p.slug,
      referrer,
      source,
      country,
      device: pick(DEVICES),
      browser: pick(BROWSERS),
      visitor_hash: visitor,
      session_id: session,
      duration_ms: 30000 + Math.floor(Math.random() * 210000),
      created_at: when.toISOString(),
    });

    // some readers click through to a store
    if (Math.random() < p.conv) {
      const store = Math.random() < 0.58 ? "play_store" : "app_store";
      clicks.push({
        post_slug: p.slug,
        path: `/blog/${p.slug}`,
        link_url:
          store === "play_store"
            ? "https://play.google.com/store/apps/details?id=com.parentalvalues"
            : "https://apps.apple.com/app/parental-values",
        link_type: store,
        country,
        source,
        visitor_hash: visitor,
        session_id: session,
        created_at: new Date(when.getTime() + 60000 + Math.random() * 240000).toISOString(),
      });
    }
    // a few look at a competitor instead
    if (Math.random() < 0.006) {
      clicks.push({
        post_slug: p.slug,
        path: `/blog/${p.slug}`,
        link_url: "https://www.qustodio.com",
        link_type: "competitor",
        country,
        source,
        visitor_hash: visitor,
        session_id: session,
        created_at: new Date(when.getTime() + 90000).toISOString(),
      });
    }
  }
}

// insert in batches so the request bodies stay small
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
for (const batch of chunk(views, 500)) await post("pageviews", batch);
for (const batch of chunk(clicks, 500)) await post("clicks", batch);

console.log(`Inserted ${views.length} pageviews and ${clicks.length} clicks across ${DAYS} days.`);
console.log(`Overall conversion: ${((clicks.filter((c) => c.link_type !== "competitor").length / views.length) * 100).toFixed(2)}%`);

// ------------------------------------------------------------ social posts
// Needs migration 0002. Uses Picsum (seeded, so the same image every reload)
// purely as demo art — swap in real Instagram thumbnails before launch.
// The first two use the REAL Remotion reels, copied to pv-blog/public/social/.
// The starred one plays big at the top of the "Follow us" band.
const SOCIAL = [
  {
    q: "family evening together home",
    caption: "Screen time your child EARNS beats screen time you take away. Same hour, completely different fight.",
    likes: 3120,
    video: "/social/pv-reel-v2.mp4",
    poster: "/social/pv-reel-v2.jpg",
    featured: true,
  },
  {
    q: "teenager scrolling phone face lit",
    caption: "Your kid isn't addicted. The app is designed by 200 engineers to hold their attention. Different problem, different fix.",
    likes: 2610,
    video: "/social/pv-reel-v1.mp4",
    poster: "/social/pv-reel-v1.jpg",
  },
  { q: "child solving puzzle concentration", caption: "The 3 words that end the phone argument: “screens off at 9”. Not negotiable, not a debate — just the routine.", likes: 1840 },
  { q: "hands holding smartphone closeup", caption: "TikTok's own screen-time limit can be switched off by the child in 4 taps. Here's the setting that can't.", likes: 1290 },
  { q: "child bedroom sleeping peaceful", caption: "Phones out of bedrooms is the single rule with the most evidence behind it. Start there.", likes: 2240 },
  { q: "mother daughter conversation kitchen", caption: "“I'm the only one whose parents do this.” They're not. 61% of UK parents set a bedtime phone rule — Ofcom.", likes: 1670 },
];

/** Square crops for the grid tiles. */
async function squarePhoto(q, seed) {
  if (!PEXELS_KEY) return `https://picsum.photos/seed/${seed}/600/600`;
  try {
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=square&per_page=1`,
      { headers: { Authorization: PEXELS_KEY, "User-Agent": "Mozilla/5.0" } },
    );
    const p = r.ok ? (await r.json()).photos?.[0] : null;
    return p
      ? `${p.src.original}?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop`
      : `https://picsum.photos/seed/${seed}/600/600`;
  } catch {
    return `https://picsum.photos/seed/${seed}/600/600`;
  }
}

const socialImages = await Promise.all(
  SOCIAL.map((s, i) => squarePhoto(s.q, `askparent${i + 1}`)),
);

const socialRes = await post(
  "social_posts",
  SOCIAL.map((s, i) => ({
    platform: "instagram",
    permalink: `https://www.instagram.com/p/DEMO${i + 1}/`,
    image: socialImages[i],
    caption: s.caption,
    alt: s.caption.slice(0, 90),
    likes: s.likes,
    position: i,
    active: true,
    video: s.video ?? "",
    poster: s.poster ?? "",
    featured: Boolean(s.featured),
  })),
);

if (socialRes.ok) {
  console.log(`Inserted ${SOCIAL.length} demo Instagram posts.`);
} else {
  console.log("Skipped social posts — run db/0002_social_and_backlinks.sql first.");
}
console.log("\nNext: open the admin → Backlinks → “Sync from traffic” to discover the referring domains.");

await db.end();
