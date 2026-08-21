// Users and sessions.
import "server-only";
import { q, one } from "@/lib/db";

export type SessionUser = { id: string; email: string; name: string | null };

// Looked up by token hash; the raw token is never stored.
export const findUserBySessionToken = (tokenHash: string) =>
  one<SessionUser>(
    `SELECT u.id, u.email, u.name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()`,
    [tokenHash],
  );

export const findCredentials = (email: string) =>
  one<{ id: string; password_hash: string }>(
    `SELECT id, password_hash FROM users WHERE lower(email) = $1`,
    [email],
  );

export const createSession = (s: {
  userId: string; tokenHash: string; userAgent: string | null; ip: string | null; expires: Date;
}) =>
  q(
    `INSERT INTO sessions (user_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [s.userId, s.tokenHash, s.userAgent, s.ip, s.expires],
  );

export const touchLastLogin = (userId: string) =>
  q(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);

export const deleteSession = (tokenHash: string) =>
  q(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);

export const deleteAllSessions = (userId: string) =>
  q(`DELETE FROM sessions WHERE user_id = $1`, [userId]);

export const deleteExpiredSessions = () =>
  q(`DELETE FROM sessions WHERE expires_at < now()`);
