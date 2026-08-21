/**
 * Environment configuration — the single place this app reads process.env.
 *
 * Validated once, at startup, so a missing secret is a loud error on boot
 * rather than a confusing 500 the first time someone uploads an image. Import
 * `env` anywhere server-side; never read process.env directly again.
 *
 * SERVER ONLY. This module holds the database password, the AI keys and the S3
 * credentials, so `server-only` makes importing it from a client component a
 * build error rather than a leak.
 *
 * `next build` evaluates server modules, and a Docker image is usually built
 * without runtime secrets — so during the build we warn instead of throwing.
 * At runtime a missing variable is still fatal.
 */
import "server-only";

const isBuild = process.env.NEXT_PHASE === "phase-production-build";
const isProd = process.env.NODE_ENV === "production";

const missing: string[] = [];
const warnings: string[] = [];

/** Required always. */
function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) missing.push(name);
  return v ?? "";
}

/** Required in production only — dev can run without it. */
function prodReq(name: string): string {
  const v = process.env[name]?.trim();
  if (!v && isProd) missing.push(`${name} (required in production)`);
  return v ?? "";
}

/** Optional, with a default. */
function opt(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd,

  /** Postgres. Full read/write — the admin owns this database. */
  DATABASE_URL: req("DATABASE_URL"),

  /** Single shared admin password. See lib/auth.ts. */
  ADMIN_PASSWORD: prodReq("ADMIN_PASSWORD"),
  /** The public site: where to send the "refresh now" ping, and preview links. */
  SITE_URL: opt("SITE_URL").replace(/\/$/, ""),
  /** Must match the same value in the blog app. */
  REVALIDATE_SECRET: prodReq("REVALIDATE_SECRET"),

  /** Object storage (MinIO, S3-compatible). */
  S3_ENDPOINT: req("S3_ENDPOINT").replace(/\/$/, ""),
  S3_BUCKET: opt("S3_BUCKET", "media"),
  S3_REGION: opt("S3_REGION", "us-east-1"),
  S3_ACCESS_KEY: req("S3_ACCESS_KEY"),
  S3_SECRET_KEY: req("S3_SECRET_KEY"),
  /** Base URL stored in the database and served to browsers. */
  S3_PUBLIC_URL: req("S3_PUBLIC_URL").replace(/\/$/, ""),

  /** AI. Groq is primary, Gemini is the fallback AND generates embeddings. */
  GROQ_API_KEY: opt("GROQ_API_KEY"),
  GEMINI_API_KEY: opt("GEMINI_API_KEY"),
  /** Optional: stock photo search in the cover picker. */
  PEXELS_API_KEY: opt("PEXELS_API_KEY"),
} as const;

// ---- degraded-but-running conditions: warn, don't fail ---------------------
if (!config.GROQ_API_KEY && !config.GEMINI_API_KEY) {
  warnings.push("No GROQ_API_KEY or GEMINI_API_KEY — the AI assistant and embeddings are disabled.");
} else if (!config.GEMINI_API_KEY) {
  warnings.push("No GEMINI_API_KEY — embeddings are unavailable, so 'related reading' on the blog will fall back to same-category.");
}
if (!config.SITE_URL) {
  warnings.push("No SITE_URL — publishing won't ping the site to refresh, and preview links can't be built.");
}

if (missing.length) {
  const message =
    `[env] Missing required environment variable${missing.length > 1 ? "s" : ""}:\n` +
    missing.map((m) => `  - ${m}`).join("\n");
  if (isBuild) console.warn(`${message}\n(build phase — must be set at runtime)`);
  else throw new Error(`${message}\n\nCopy .env.example to .env.local and fill it in.`);
}

for (const w of warnings) console.warn(`[env] ${w}`);

export const env = config;
export type Env = typeof config;
