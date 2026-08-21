import { requireAuth } from "@/features/auth/services/session";
import { listBacklinks, listReferringDomains } from "@/features/backlinks/queries";
import { publishedTitles } from "@/features/posts/queries";
import { Shell, PageHead } from "@/components/Shell";
import { BacklinksPanel, type Backlink, type ReferringDomain } from "@/features/backlinks/components/BacklinksPanel";

export const dynamic = "force-dynamic";

export default async function BacklinksPage() {
  await requireAuth();
  // These tables come from migration 0002 — degrade gracefully if it hasn't run.
  let links: Backlink[] = [];
  let referrers: ReferringDomain[] = [];
  let migrationError: string | null = null;

  try {
    [links, referrers] = await Promise.all([listBacklinks(), listReferringDomains(100)]);
  } catch (e) {
    migrationError = (e as Error).message;
  }

  const postTitles = (await publishedTitles()).map((p) => p.title);

  return (
    <Shell>
      <PageHead
        title="Backlinks"
        subtitle="Links pointing at you from other sites — the single biggest thing separating a new blog from a ranking one."
      />

      {migrationError ? (
        <div className="p-8">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-extrabold text-amber-900">One migration to run first</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-amber-800">
              Run{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px]">
                db/0002_social_and_backlinks.sql
              </code>{" "}
              against the database, then reload this page.
            </p>
            <p className="mt-3 text-[13px] text-amber-700">
              {migrationError}
            </p>
          </div>
        </div>
      ) : (
        <BacklinksPanel links={links} referrers={referrers} postTitles={postTitles} />
      )}
    </Shell>
  );
}
