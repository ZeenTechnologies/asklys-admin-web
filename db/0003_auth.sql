-- ---------------------------------------------------------------------------
--  0003 — real accounts and revocable sessions.
--
--  Replaces the single shared ADMIN_PASSWORD env var. That scheme had no way
--  to revoke a session (the cookie was a pure function of the password), no
--  audit trail, and no notion of who did what.
--
--  Create the first account with:  node scripts/create-admin.mjs
-- ---------------------------------------------------------------------------

create table if not exists users (
  id             uuid primary key default gen_random_uuid(),
  email          text        not null,
  -- scrypt$N$r$p$salt$hash — see src/lib/password.ts
  password_hash  text        not null,
  name           text,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz
);

-- Case-insensitive uniqueness without needing the citext extension.
create unique index if not exists users_email_key on users (lower(email));

create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null references users(id) on delete cascade,
  -- We store sha256(token), never the token itself: a leaked database dump
  -- cannot then be used to log in.
  token_hash    text        not null unique,
  user_agent    text,
  ip            text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null
);

create index if not exists sessions_user_idx    on sessions (user_id);
create index if not exists sessions_expires_idx on sessions (expires_at);

-- Both tables are admin-only. `web_reader` holds no grant on them; RLS with no
-- policy is the second lock on the same door.
alter table users    enable row level security;
alter table sessions enable row level security;
