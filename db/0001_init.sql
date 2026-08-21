-- ============================================================================
--  Ask Parent — admin schema
--  Run against the asklys database. Safe to re-run.
--  Safe to re-run: everything is IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================================

create extension if not exists "pgcrypto";
-- pgvector powers the "related posts" recommendations
create extension if not exists "vector";

-- ---------------------------------------------------------------------------
-- POSTS
-- ---------------------------------------------------------------------------
create table if not exists posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  excerpt       text default '',
  -- editor payload (BlockNote JSON) + rendered html we serve to the blog
  body_json     jsonb,
  body_html     text default '',
  category      text not null default 'screen-time',
  author        text not null default 'The Ask Parent Team',

  -- presentation choices made in the composer
  post_type     text not null default 'article',   -- article|listicle|comparison|how-to|news
  card_style    text not null default 'standard',  -- hero|standard|compact|featured
  font_style    text not null default 'default',   -- default|serif|editorial
  cover_image   text default '',
  cover_alt     text default '',

  -- SEO
  seo_title     text,
  seo_description text,
  keywords      text[] default '{}',
  tags          text[] default '{}',
  faq           jsonb default '[]'::jsonb,         -- [{q,a}] -> FAQPage schema

  featured      boolean not null default false,
  status        text not null default 'draft',     -- draft|scheduled|published
  published_at  timestamptz,
  scheduled_for timestamptz,
  read_mins     int default 1,

  -- recommendations (Gemini embedding, 768 dims)
  embedding     vector(768),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists posts_status_pub_idx on posts (status, published_at desc);
create index if not exists posts_category_idx   on posts (category);
create index if not exists posts_slug_idx       on posts (slug);

-- keep updated_at honest
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists posts_touch on posts;
create trigger posts_touch before update on posts
for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- MEDIA  (images uploaded in the composer; files live in object storage)
-- ---------------------------------------------------------------------------
create table if not exists media (
  id          uuid primary key default gen_random_uuid(),
  url         text not null,
  path        text,
  alt         text default '',
  width       int,
  height      int,
  size_bytes  bigint,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ANALYTICS
--   pageviews: one row per view. Cookieless — visitor_hash is a daily-salted
--   hash of IP+UA, so nobody is personally identifiable and no consent banner
--   is required.
-- ---------------------------------------------------------------------------
create table if not exists pageviews (
  id            bigserial primary key,
  path          text not null,
  post_slug     text,
  referrer      text,
  source        text,              -- google|pinterest|reddit|x|direct|…
  country       text,              -- from Vercel's geo header
  city          text,
  device        text,              -- mobile|tablet|desktop
  browser       text,
  visitor_hash  text,              -- daily-rotating, not personal
  session_id    text,
  duration_ms   int,               -- filled in on unload
  created_at    timestamptz not null default now()
);

create index if not exists pv_created_idx  on pageviews (created_at desc);
create index if not exists pv_slug_idx     on pageviews (post_slug, created_at desc);
create index if not exists pv_country_idx  on pageviews (country);
create index if not exists pv_source_idx   on pageviews (source);

-- clicks: THE conversion metric — which post sent someone to the App Store
create table if not exists clicks (
  id            bigserial primary key,
  post_slug     text,
  path          text,
  link_url      text not null,
  link_type     text,              -- app_store|play_store|competitor|internal|external
  country       text,
  source        text,
  visitor_hash  text,
  session_id    text,
  created_at    timestamptz not null default now()
);

create index if not exists clicks_created_idx on clicks (created_at desc);
create index if not exists clicks_slug_idx    on clicks (post_slug, created_at desc);
create index if not exists clicks_type_idx    on clicks (link_type);

-- newsletter signups
create table if not exists subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  source_path text,
  country     text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- DASHBOARD VIEWS  (fast aggregates the admin reads directly)
-- ---------------------------------------------------------------------------

-- per-post performance incl. the funnel: views -> store clicks
create or replace view post_performance as
select
  p.slug,
  p.title,
  p.category,
  p.status,
  p.published_at,
  coalesce(v.views, 0)            as views,
  coalesce(v.visitors, 0)         as visitors,
  coalesce(c.store_clicks, 0)     as store_clicks,
  case when coalesce(v.views,0) = 0 then 0
       else round((coalesce(c.store_clicks,0)::numeric / v.views) * 100, 2)
  end                             as click_rate_pct
from posts p
left join (
  select post_slug, count(*) views, count(distinct visitor_hash) visitors
  from pageviews where post_slug is not null group by post_slug
) v on v.post_slug = p.slug
left join (
  select post_slug, count(*) store_clicks
  from clicks
  where link_type in ('app_store','play_store') and post_slug is not null
  group by post_slug
) c on c.post_slug = p.slug;

-- traffic by country
create or replace view traffic_by_country as
select country,
       count(*)                       as views,
       count(distinct visitor_hash)   as visitors
from pageviews
where country is not null
group by country
order by views desc;

-- traffic by source
create or replace view traffic_by_source as
select coalesce(source,'direct')      as source,
       count(*)                       as views,
       count(distinct visitor_hash)   as visitors
from pageviews
group by 1
order by views desc;

-- daily totals for the chart
create or replace view daily_traffic as
select date_trunc('day', created_at)::date as day,
       count(*)                            as views,
       count(distinct visitor_hash)        as visitors
from pageviews
group by 1
order by 1 desc;

-- ---------------------------------------------------------------------------
-- RECOMMENDATIONS  (vector similarity for "you might also like")
-- ---------------------------------------------------------------------------
create or replace function related_posts(
  query_embedding vector(768),
  exclude_slug    text default '',
  match_count     int  default 3
)
returns table (slug text, title text, excerpt text, cover_image text, similarity float)
language sql stable as $$
  select p.slug, p.title, p.excerpt, p.cover_image,
         1 - (p.embedding <=> query_embedding) as similarity
  from posts p
  where p.status = 'published'
    and p.embedding is not null
    and p.slug <> exclude_slug
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- SECURITY
--   The public blog reads published posts. Everything else is server-only
--   (the admin uses the service-role key, which bypasses RLS).
-- ---------------------------------------------------------------------------
alter table posts       enable row level security;
alter table media       enable row level security;
alter table pageviews   enable row level security;
alter table clicks      enable row level security;
alter table subscribers enable row level security;

drop policy if exists "public reads published posts" on posts;
create policy "public reads published posts" on posts
  for select using (status = 'published');

-- analytics: anyone may INSERT (that's the tracker) but nobody may read
drop policy if exists "anon can log pageviews" on pageviews;
create policy "anon can log pageviews" on pageviews for insert with check (true);

drop policy if exists "anon can log clicks" on clicks;
create policy "anon can log clicks" on clicks for insert with check (true);

drop policy if exists "anon can subscribe" on subscribers;
create policy "anon can subscribe" on subscribers for insert with check (true);
