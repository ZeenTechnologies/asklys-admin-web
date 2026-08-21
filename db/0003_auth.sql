-- 0003 — accounts and revocable sessions, replacing the shared ADMIN_PASSWORD.
-- Create the first account with:  node scripts/create-admin.mjs

create table if not exists users (
  id             uuid primary key default gen_random_uuid(),
  email          text        not null,
  password_hash  text        not null,   -- scrypt$N$r$p$salt$hash, see src/lib/password.ts
  name           text,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz
);

-- Case-insensitive uniqueness without the citext extension.
create unique index if not exists users_email_key on users (lower(email));

create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null references users(id) on delete cascade,
  token_hash    text        not null unique,   -- sha256(token); the token itself is never stored
  user_agent    text,
  ip            text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null
);

create index if not exists sessions_user_idx    on sessions (user_id);
create index if not exists sessions_expires_idx on sessions (expires_at);

-- Admin-only. web_reader holds no grant here; RLS with no policy is the second lock.
alter table users    enable row level security;
alter table sessions enable row level security;
