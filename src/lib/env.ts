// Environment config: the single place this app reads process.env. Server-only.
import "server-only";

// next build evaluates server modules without runtime secrets, so warn during build, throw at runtime.
const isBuild = process.env.NEXT_PHASE === "phase-production-build";
const isProd = process.env.NODE_ENV === "production";

const missing: string[] = [];
const warnings: string[] = [];

function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) missing.push(name);
  return v ?? "";
}

function prodReq(name: string): string {
  const v = process.env[name]?.trim();
  if (!v && isProd) missing.push(`${name} (required in production)`);
  return v ?? "";
}

function opt(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd,

  DATABASE_URL: req("DATABASE_URL"),

  // The public site: publish webhook target and preview-link base.
  SITE_URL: opt("SITE_URL").replace(/\/$/, ""),
  REVALIDATE_SECRET: prodReq("REVALIDATE_SECRET"),

  // Object storage. S3_ENDPOINT receives uploads; S3_PUBLIC_URL is what readers fetch.
  S3_ENDPOINT: req("S3_ENDPOINT").replace(/\/$/, ""),
  S3_BUCKET: opt("S3_BUCKET", "media"),
  S3_REGION: opt("S3_REGION", "us-east-1"),
  S3_ACCESS_KEY: req("S3_ACCESS_KEY"),
  S3_SECRET_KEY: req("S3_SECRET_KEY"),
  S3_PUBLIC_URL: req("S3_PUBLIC_URL").replace(/\/$/, ""),

  // Groq is primary; Gemini is the fallback and the only source of embeddings.
  GROQ_API_KEY: opt("GROQ_API_KEY"),
  GEMINI_API_KEY: opt("GEMINI_API_KEY"),
  PEXELS_API_KEY: opt("PEXELS_API_KEY"),
} as const;

if (!config.GROQ_API_KEY && !config.GEMINI_API_KEY) {
  warnings.push("No GROQ_API_KEY or GEMINI_API_KEY — the AI assistant and embeddings are disabled.");
} else if (!config.GEMINI_API_KEY) {
  warnings.push("No GEMINI_API_KEY — no embeddings, so 'related reading' falls back to same-category.");
}
if (!config.SITE_URL) {
  warnings.push("No SITE_URL — publishing won't refresh the site, and preview links can't be built.");
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
