// Auth: real accounts, revocable sessions. Create accounts with scripts/create-admin.mjs.
import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { q, one } from "./db";
import { verifyPassword } from "./password";

const COOKIE = "asklys_session";
const SESSION_DAYS = 30;

// Only the hash is stored, so a leaked database dump can't be used to log in.
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type SessionUser = { id: string; email: string; name: string | null };

// cache() so the many requireAuth() calls in one render share a single query.
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  return one<SessionUser>(
    `SELECT u.id, u.email, u.name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()`,
    [hashToken(token)],
  );
});

export async function isLoggedIn(): Promise<boolean> {
  return (await currentUser()) !== null;
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

// In-memory throttle. Correct for one container; move to a table if this is ever scaled out.
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

  // Hash even when the user doesn't exist, so timing doesn't reveal which emails are registered.
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

// Ends this session only; other devices stay signed in.
export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await q(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
  jar.delete(COOKIE);
}

export async function signOutAllSessions(userId: string): Promise<void> {
  await q(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

export async function purgeExpiredSessions(): Promise<void> {
  await q(`DELETE FROM sessions WHERE expires_at < now()`);
}
