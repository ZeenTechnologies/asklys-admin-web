-- ============================================================================
--  Ask Parent — migration 0002
--  Adds: Instagram/social feed, backlink tracking, external-citation storage.
--  Run against the asklys database. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SOCIAL POSTS
--   Powers the "Follow us on Instagram" grid on the blog homepage.
--   Managed from the admin so the blog never needs a Facebook app token.
--   If `permalink` is a real instagram.com/p/... URL the blog can also render
--   the official embed; otherwise it renders our own card with `image`.
-- ---------------------------------------------------------------------------
create table if not exists social_posts (
  id          uuid primary key default gen_random_uuid(),
  platform    text not null default 'instagram',  -- instagram|tiktok|pinterest|x|youtube
  permalink   text not null,                      -- the public post URL
  image       text default '',                    -- thumbnail we host/proxy
  caption     text default '',
  alt         text default '',
  post_slug   text,                               -- optional: article this promotes
  likes       int  default 0,
  position    int  default 0,                     -- manual ordering, low = first
  active      boolean not null default true,
  -- The reel itself. Instagram will not let anyone hotlink a video, so this is
  -- our own render (the Remotion reels) served from /public or Storage.
  video       text default '',                    -- mp4 URL, portrait 9:16
  poster      text default '',                    -- first-frame image
  featured    boolean not null default false,     -- plays big at the top
  created_at  timestamptz not null default now()
);

-- re-runnable: add the video columns to an existing install
alter table social_posts add column if not exists video    text default '';
alter table social_posts add column if not exists poster   text default '';
alter table social_posts add column if not exists featured boolean not null default false;

create index if not exists social_active_idx   on social_posts (active, position);
create index if not exists social_featured_idx on social_posts (featured) where featured;

-- ---------------------------------------------------------------------------
-- BACKLINKS
--   Two kinds live here:
--     detected — auto-discovered from real referrer traffic (source='referrer')
--     manual   — outreach you logged yourself (source='manual')
--   `status` tracks the outreach pipeline for the manual ones.
-- ---------------------------------------------------------------------------
create table if not exists backlinks (
  id            uuid primary key default gen_random_uuid(),
  domain        text not null,
  url           text,                  -- the exact page linking to us
  target_path   text,                  -- the page of ours it points at
  anchor        text,
  kind          text not null default 'manual',   -- manual|detected
  status        text not null default 'live',     -- idea|contacted|replied|live|rejected
  authority     int,                   -- 0-100, your own estimate or a tool's
  dofollow      boolean default true,
  referrals     int default 0,         -- real sessions this link has sent us
  notes         text default '',
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz,
  created_at    timestamptz not null default now(),
  unique (domain, target_path)
);

create index if not exists backlinks_kind_idx   on backlinks (kind, status);
create index if not exists backlinks_domain_idx on backlinks (domain);

-- ---------------------------------------------------------------------------
-- OUTBOUND CITATIONS
--   External sources cited inside an article. Linking OUT to authoritative
--   research is a real ranking/E-E-A-T signal, and it is the thing that makes
--   other sites willing to link back.
-- ---------------------------------------------------------------------------
create table if not exists citations (
  id          uuid primary key default gen_random_uuid(),
  post_slug   text not null,
  title       text not null,
  url         text not null,
  publisher   text default '',
  year        int,
  doi         text,
  applied     boolean not null default false,   -- inserted into the body yet?
  created_at  timestamptz not null default now()
);

create index if not exists citations_slug_idx on citations (post_slug);

-- ---------------------------------------------------------------------------
-- REFERRER → BACKLINK DISCOVERY
--   Every external referring domain we have ever seen, with how much traffic
--   it sent. This is genuine backlink data — a domain can only appear here if
--   somebody clicked a real link to us from it.
-- ---------------------------------------------------------------------------
create or replace view referring_domains as
select
  -- strip protocol and any path -> bare hostname
  lower(split_part(split_part(replace(replace(referrer, 'https://', ''), 'http://', ''), '/', 1), ':', 1)) as domain,
  count(*)                          as sessions,
  count(distinct visitor_hash)      as visitors,
  count(distinct post_slug)         as landing_pages,
  min(created_at)                   as first_seen,
  max(created_at)                   as last_seen
from pageviews
where referrer is not null
  and referrer <> ''
group by 1
having lower(split_part(split_part(replace(replace(referrer, 'https://', ''), 'http://', ''), '/', 1), ':', 1)) <> ''
order by sessions desc;

-- ---------------------------------------------------------------------------
-- SECURITY
--   social_posts is the only new table the public blog reads.
-- ---------------------------------------------------------------------------
alter table social_posts enable row level security;
alter table backlinks    enable row level security;
alter table citations    enable row level security;

drop policy if exists "public reads active social posts" on social_posts;
create policy "public reads active social posts" on social_posts
  for select using (active = true);

-- backlinks + citations stay server-only (admin uses the service-role key).
