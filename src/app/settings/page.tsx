import { requireAuth } from "@/lib/auth";
import { Shell, PageHead } from "@/components/Shell";
import { CATEGORIES } from "@/lib/types";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const has = (v?: string) => Boolean(v && v.length > 4);

function Row({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-3 last:border-0">
      <div>
        <p className="font-bold text-ink text-[15px]">{label}</p>
        <p className="text-[13px] text-muted">{detail}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase ${
        ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}>
        {ok ? "Connected" : "Not set"}
      </span>
    </div>
  );
}

export default async function SettingsPage() {
  await requireAuth();

  return (
    <Shell>
      <PageHead title="Settings" subtitle="Connections and publishing configuration." />

      <div className="p-8 space-y-6 max-w-3xl">
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-extrabold text-ink mb-2">Connections</h2>
          <Row label="Postgres" ok={has(env.DATABASE_URL)} detail="Posts, media and analytics database" />
          <Row label="Groq" ok={has(env.GROQ_API_KEY)} detail="Drafting, SEO and FAQ generation" />
          <Row label="Gemini" ok={has(env.GEMINI_API_KEY)} detail="Embeddings for related-post recommendations" />
          <Row label="Site webhook" ok={has(env.SITE_URL)} detail={env.SITE_URL || "Publishing target not set"} />
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-extrabold text-ink mb-3">Categories</h2>
          <p className="text-[14px] text-muted mb-3">
            These are the sections on the blog. Changing them requires a code change in both apps.
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <span key={c.slug} className="rounded-full bg-wash px-3.5 py-1.5 text-[13px] font-bold text-ink">
                {c.name}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-extrabold text-ink mb-2">Admin password</h2>
          <p className="text-[14px] text-muted">
            Set by <code className="font-mono">ADMIN_PASSWORD</code> in the environment. Change it there
            and redeploy — it is never stored in the database.
          </p>
        </section>
      </div>
    </Shell>
  );
}
