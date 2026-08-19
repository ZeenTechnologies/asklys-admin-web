/**
 * Database access.
 *
 * Replaces `lib/supabase.ts`. Everything server-side goes through here — the
 * admin owns full read/write on the `asklys` database, so this module must
 * never be imported into a "use client" component.
 *
 * One pool per process. Next.js hot-reload re-evaluates modules on every edit,
 * so the pool is stashed on globalThis in development; without that you exhaust
 * Postgres connections after a dozen saves.
 */
import { Pool, type QueryResultRow } from "pg";

const g = globalThis as unknown as { _pgPool?: Pool };

export const pool =
  g._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") g._pgPool = pool;

/** Rows from a parameterised query. Always use $1/$2 — never string interpolation. */
export async function q<T extends QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const { rows } = await pool.query<T>(sql, params);
  return rows;
}

/** First row, or null. Replaces supabase-js `.single()` / `.maybeSingle()`. */
export async function one<T extends QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

/** `SELECT count(*)` as a number. Replaces `{ count: "exact", head: true }`. */
export async function count(sql: string, params?: unknown[]): Promise<number> {
  const rows = await q<{ count: string }>(sql, params);
  return Number(rows[0]?.count ?? 0);
}

/**
 * pgvector round-trip.
 *
 * node-postgres has no parser for the `vector` type, so it arrives as the
 * string "[0.1,0.2,…]" and must be sent back in the same form. Passing a JS
 * array straight into a `vector` column fails — this is the single easiest
 * thing to get wrong when writing embeddings.
 */
export const toVector = (v: number[]): string => `[${v.join(",")}]`;

export const fromVector = (v: string | number[] | null): number[] | null => {
  if (!v) return null;
  return typeof v === "string" ? (JSON.parse(v) as number[]) : v;
};
