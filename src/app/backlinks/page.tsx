import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { Shell, PageHead } from "@/components/Shell";
import { BacklinksPanel, type Backlink, type ReferringDomain } from "@/components/BacklinksPanel";

export const dynamic = "force-dynamic";

export default async function BacklinksPage() {
  await requireAuth();
  const db = supabaseAdmin();

  // These tables come from migration 0002 — degrade gracefully if it hasn't run.
  const [linksRes, refsRes, postsRes] = await Promise.all([
    db.from("backlinks").select("*").order("referrals", { ascending: false }),
    db.from("referring_domains").select("*").limit(100),
    db.from("posts").select("title").eq("status", "published"),
  ]);

  const missingMigration = Boolean(linksRes.error || refsRes.error);

  return (
    <Shell>
      <PageHead
        title="Backlinks"
        subtitle="Links pointing at you from other sites — the single biggest thing separating a new blog from a ranking one."
      />

      {missingMigration ? (
        <div className="p-8">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-extrabold text-amber-900">One migration to run first</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-amber-800">
              Open Supabase → SQL Editor and run{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px]">
                pv-admin/supabase/0002_social_and_backlinks.sql
              </code>
              , then reload this page.
            </p>
            <p className="mt-3 text-[13px] text-amber-700">
              {linksRes.error?.message ?? refsRes.error?.message}
            </p>
          </div>
        </div>
      ) : (
        <BacklinksPanel
          links={(linksRes.data ?? []) as Backlink[]}
          referrers={(refsRes.data ?? []) as ReferringDomain[]}
          postTitles={(postsRes.data ?? []).map((p) => (p as { title: string }).title)}
        />
      )}
    </Shell>
  );
}
