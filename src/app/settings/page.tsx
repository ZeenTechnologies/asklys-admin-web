import { requireAuth } from "@/lib/auth";
import { Shell, PageHead } from "@/components/Shell";
import { CATEGORIES } from "@/lib/types";

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
  const devBypass = process.env.DEV_SKIP_AUTH === "1";

  return (
    <Shell>
      <PageHead title="Settings" subtitle="Connections and publishing configuration." />

      <div className="p-8 space-y-6 max-w-3xl">
        {devBypass && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
            <p className="font-extrabold text-amber-900">Development login bypass is ON</p>
            <p className="mt-1 text-[14px] text-amber-800">
              Anyone who can reach this server gets in without a password. It cannot apply to a
              production build, but remove <code className="font-mono">DEV_SKIP_AUTH=1</code> from
              <code className="font-mono"> .env.local</code> before deploying.
            </p>
          </div>
        )}

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-extrabold text-ink mb-2">Connections</h2>
          <Row label="Supabase" ok={has(process.env.NEXT_PUBLIC_SUPABASE_URL)} detail="Posts, media and analytics database" />
          <Row label="Groq" ok={has(process.env.GROQ_API_KEY)} detail="Drafting, SEO and FAQ generation" />
          <Row label="Gemini" ok={has(process.env.GEMINI_API_KEY)} detail="Embeddings for related-post recommendations" />
          <Row label="Blog webhook" ok={has(process.env.BLOG_URL)} detail={process.env.BLOG_URL || "Publishing target not set"} />
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
