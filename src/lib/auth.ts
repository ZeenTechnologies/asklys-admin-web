/**
 * Authentication — real accounts, revocable sessions.
 *
 * The session cookie holds a random 256-bit token; the database stores only
 * sha256 of it. So a stolen database dump can't be used to log in, and deleting
 * the row logs that one session out immediately — neither of which was true of
 * the old scheme, where the cookie was just sha256(ADMIN_PASSWORD) and the only
 * way to revoke anything was to change the password for everyone.
 *
 * Create accounts with:  node scripts/create-admin.mjs
 */
import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { q, one } from "./db";
import { verifyPassword } from "./password";

const COOKIE = "asklys_session";
const SESSION_DAYS = 30;

/** Sessions are looked up by hash, so the raw token never touches the database. */
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type SessionUser = { id: string; email: string; name: string | null };

/**
 * The signed-in user, or null.
 *
 * Wrapped in React's `cache` so the dozen `requireAuth()` calls in a single
 * render share one query instead of hitting Postgres each time.
 */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const row = await one<{ id: string; email: string; name: string | null }>(
    `SELECT u.id, u.email, u.name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return row;
});

export async function isLoggedIn(): Promise<boolean> {
  return (await currentUser()) !== null;
}

/** Call at the top of every protected page. */
export async function requireAuth(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Throttle by email, in memory.
 *
 * Enough for a single container, which is what this is. If the admin is ever
 * scaled to more than one instance, move this to a table — an in-process map
 * gives an attacker one bucket per replica.
 */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60_000;

function throttled(key: string): boolean {
  const rec = attempts.get(key);
  if (!rec) return false;
  if (Date.now() > rec.until) { attempts.delete(key); return false; }
  return rec.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const rec = attempts.get(key);
  attempts.set(key, {
    count: (rec && Date.now() <= rec.until ? rec.count : 0) + 1,
    until: Date.now() + LOCKOUT_MS,
  });
}

export type SignInResult = { ok: true } | { ok: false; reason: "invalid" | "throttled" };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const key = email.trim().toLowerCase();
  if (throttled(key)) return { ok: false, reason: "throttled" };

  const user = await one<{ id: string; password_hash: string }>(
    `SELECT id, password_hash FROM users WHERE lower(email) = $1`,
    [key],
  );

  // Verify even when the user doesn't exist, against a throwaway hash, so the
  // response time doesn't reveal which emails are registered.
  const stored = user?.password_hash ?? "scrypt$65536$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA";
  const valid = await verifyPassword(password, stored);

  if (!user || !valid) {
    recordFailure(key);
    return { ok: false, reason: "invalid" };
  }
  attempts.delete(key);

  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);

  await q(
    `INSERT INTO sessions (user_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      user.id,
      hashToken(token),
      h.get("user-agent")?.slice(0, 400) ?? null,
      h.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
      expires,
    ],
  );
  await q(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });

  return { ok: true };
}

/** Ends this session only — other devices stay signed in. */
export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await q(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
  jar.delete(COOKIE);
}

/** Sign out everywhere. Use if a laptop goes missing. */
export async function signOutAllSessions(userId: string): Promise<void> {
  await q(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

/** Housekeeping — expired rows serve no purpose. */
export async function purgeExpiredSessions(): Promise<void> {
  await q(`DELETE FROM sessions WHERE expires_at < now()`);
}
