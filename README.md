# Ask Parent — admin

The CMS, analytics and SEO console behind [Ask Parent](https://github.com/ZeenTechnologies/Asklys-web).
Private tool, not public-facing.

## How it connects to the website

They never talk to each other directly. **Both read and write the same Postgres
database** — that shared database is the entire link.

```
  ADMIN  ──writes──▶  POSTGRES  ──reads──▶  WEBSITE  ──▶  visitors
    │                                          ▲
    └────── "refresh now" webhook ─────────────┘
```

So the admin can run on a laptop while the website is live on the internet, and
posts still appear. The one direct call is admin → `BLOG_URL/api/revalidate`,
which just tells the site to rebuild immediately rather than waiting for its
5-minute timer.

## Setup

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run dev                    # http://localhost:3001
```

**Database:** run the migrations against Postgres, in order:

1. `db/0001_init.sql` — posts, media, analytics, subscribers
2. `db/0002_social_and_backlinks.sql` — social feed, backlinks, citations
3. `db/0003_auth.sql` — accounts and sessions

Then create your login: `node scripts/create-admin.mjs`

## What's in it

| Section | Does |
|---|---|
| **Dashboard** | Views, visitors, store clicks, conversion, subscribers |
| **Posts** | Block editor, SEO fields with live Google preview, FAQ builder, cover-image upload or stock search, draft preview on the real site |
| **Analytics** | Filter by date, country, source, device, post; per-post funnel; outbound click log |
| **Backlinks** | Auto-detects real referring domains from traffic, plus an outreach tracker |
| **Social** | The Instagram grid and featured reel on the site's homepage |
| **AI Assistant** | Content gaps, internal links, keyword expansion, and real external sources via OpenAlex |

## AI notes

Groq is primary, Gemini is the fallback; both have free tiers.

Model names get retired without warning — Groq dropped `llama-3.3-70b-versatile`
mid-2026 and every call started failing over to Gemini silently. `src/lib/ai.ts`
therefore keeps a **list** of models and retries, and its errors name every
provider that failed. If AI breaks, check `GET api.groq.com/openai/v1/models`
for what your key can still reach.

The External Sources tool only lets the AI choose *search terms* — every source
returned comes from OpenAlex with a real DOI. That is deliberate: a fabricated
citation is worse than none.

## Scripts

```bash
node scripts/seed-starter.mjs        # WIPES everything, imports the 9 starter articles
node scripts/backfill-embeddings.mjs # embeddings for "related reading" — run after any import
node scripts/seed-demo.mjs           # fake traffic for demos.  --clear to remove
```

⚠️ `seed-starter` and `seed-demo` both delete live data. Never run either
against a production database you care about.

## Before deploying

- Remove `DEV_SKIP_AUTH` and set a real `ADMIN_PASSWORD`
- Point `BLOG_URL` at the live website
- Use the same `REVALIDATE_SECRET` in both apps
- Restrict who can reach this app — it has full write access to the database
