// Database access. Server-only: this holds full read/write on the asklys database.
import "server-only";
import { Pool, type QueryResultRow } from "pg";
import { env } from "./env";

const g = globalThis as unknown as { _pgPool?: Pool };

// One pool per process; stashed on globalThis so hot-reload doesn't exhaust connections.
export const pool =
  g._pgPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (!env.isProd) g._pgPool = pool;

// Always use $1/$2 — never string interpolation.
export async function q<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]> {
  const { rows } = await pool.query<T>(sql, params);
  return rows;
}

export async function one<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

export async function count(sql: string, params?: unknown[]): Promise<number> {
  const rows = await q<{ count: string }>(sql, params);
  return Number(rows[0]?.count ?? 0);
}

// node-postgres has no vector parser: pgvector columns arrive and must be sent as "[0.1,0.2]".
export const toVector = (v: number[]): string => `[${v.join(",")}]`;

export const fromVector = (v: string | number[] | null): number[] | null => {
  if (!v) return null;
  return typeof v === "string" ? (JSON.parse(v) as number[]) : v;
};
