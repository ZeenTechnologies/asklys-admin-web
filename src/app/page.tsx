import Link from "next/link";
import { requireAuth } from "@/features/auth/services/session";
import {
  dailyTraffic, postStatusCounts, recentSubscribers, subscriberCount,
  topPosts, trafficByCountry, trafficBySource, type PostPerformance,
} from "@/features/analytics/queries";
import { Shell, PageHead } from "@/components/Shell";
import { ArrowUpRight, Eye, FileText, Mail, MousePointerClick, Users } from "lucide-react";

export const dynamic = "force-dynamic";

type Perf = PostPerformance;

async function loadData() {
  const [statuses, rows, countries, sources, daily, subscribers, recentSubs] = await Promise.all([
    postStatusCounts(),
    topPosts(8),
    trafficByCountry(6),
    trafficBySource(6),
    dailyTraffic(30),
    subscriberCount(),
    recentSubscribers(8),
  ]);

  const byStatus = (s: string) => Number(statuses.find((r) => r.status === s)?.count ?? 0);

  return {
    published: byStatus("published"),
    drafts: byStatus("draft"),
    views: rows.reduce((s, r) => s + Number(r.views || 0), 0),
    visitors: rows.reduce((s, r) => s + Number(r.visitors || 0), 0),
    clicks: rows.reduce((s, r) => s + Number(r.store_clicks || 0), 0),
    top: rows,
    countries,
    sources,
    daily,
    subscribers,
    recentSubs,
  };
}

function Stat({
  label, value, icon: Icon, hint,
}: { label: string; value: string | number; icon: React.ElementType; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold text-muted">{label}</p>
        <Icon size={17} className="text-brand" />
      </div>
      <p className="mt-2 text-3xl font-extrabold text-ink tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export default async function Dashboard() {
  await requireAuth();
  const d = await loadData();
  const empty = d.views === 0 && d.published === 0;

  return (
    <Shell>
      <PageHead
        title="Dashboard"
        subtitle="Traffic, conversions and what to write next."
        action={
          <Link href="/posts/new" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-mid transition-colors">
            New post
          </Link>
        }
      />

      <div className="p-8 space-y-8">
        {empty && (
          <div className="rounded-xl border border-brand/30 bg-brand/5 p-5">
            <p className="font-extrabold text-ink">Nothing published yet.</p>
            <p className="mt-1 text-[15px] text-body">
              Write your first post and the numbers here start filling in. Traffic data appears
              once the blog is live and the tracker is running.
            </p>
            <Link href="/posts/new" className="mt-3 inline-block text-[14px] font-extrabold text-brand hover:underline">
              Write the first post →
            </Link>
          </div>
        )}

        {/* headline numbers */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Stat label="Published" value={d.published} icon={FileText} hint={`${d.drafts} in draft`} />
          <Stat label="Page views" value={d.views.toLocaleString()} icon={Eye} />
          <Stat label="Visitors" value={d.visitors.toLocaleString()} icon={Users} />
          <Stat label="Store clicks" value={d.clicks.toLocaleString()} icon={MousePointerClick} hint="App Store + Play" />
          <Stat
            label="Conversion"
            value={d.views ? `${((d.clicks / d.views) * 100).toFixed(1)}%` : "—"}
            icon={ArrowUpRight}
            hint="views → store"
          />
          <Stat
            label="Subscribers"
            value={d.subscribers.toLocaleString()}
            icon={Mail}
            hint="the Sunday note"
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* top posts */}
          <section className="rounded-xl border border-line bg-white overflow-hidden">
            <div className="border-b border-line px-5 py-3.5 flex items-center justify-between">
              <h2 className="font-extrabold text-ink">Post performance</h2>
              <Link href="/analytics" className="text-[13px] font-extrabold text-brand hover:underline">
                Full analytics →
              </Link>
            </div>
            {d.top.length === 0 ? (
              <p className="p-5 text-[15px] text-muted">No data yet.</p>
            ) : (
              <table className="w-full text-[14px]">
                <thead className="bg-wash text-left">
                  <tr>
                    <th className="px-5 py-2.5 font-extrabold text-ink">Post</th>
                    <th className="px-3 py-2.5 font-extrabold text-ink">Views</th>
                    <th className="px-3 py-2.5 font-extrabold text-ink">Clicks</th>
                    <th className="px-5 py-2.5 font-extrabold text-ink">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {d.top.map((r) => (
                    <tr key={r.slug} className="border-t border-line">
                      <td className="px-5 py-3">
                        <Link href={`/posts/${r.slug}`} className="font-bold text-ink hover:text-brand line-clamp-1">
                          {r.title}
                        </Link>
                        <span className="text-[12px] text-muted">{r.category}</span>
                      </td>
                      <td className="px-3 py-3 text-body">{Number(r.views).toLocaleString()}</td>
                      <td className="px-3 py-3 text-body">{Number(r.store_clicks).toLocaleString()}</td>
                      <td className="px-5 py-3 font-bold text-brand">{r.click_rate_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* traffic breakdown */}
          <div className="space-y-6">
            <section className="rounded-xl border border-line bg-white">
              <h2 className="border-b border-line px-5 py-3.5 font-extrabold text-ink">Top countries</h2>
              <div className="p-5 space-y-2.5">
                {d.countries.length === 0 && <p className="text-[14px] text-muted">No data yet.</p>}
                {d.countries.map((c: { country: string; views: number }) => (
                  <div key={c.country} className="flex justify-between text-[14px]">
                    <span className="font-semibold text-ink">{c.country}</span>
                    <span className="text-muted">{Number(c.views).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-line bg-white">
              <h2 className="border-b border-line px-5 py-3.5 font-extrabold text-ink">Traffic sources</h2>
              <div className="p-5 space-y-2.5">
                {d.sources.length === 0 && <p className="text-[14px] text-muted">No data yet.</p>}
                {d.sources.map((s: { source: string; views: number }) => (
                  <div key={s.source} className="flex justify-between text-[14px]">
                    <span className="font-semibold text-ink capitalize">{s.source}</span>
                    <span className="text-muted">{Number(s.views).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Which page earned the signup matters more than the raw count —
                it tells you what to write more of. */}
            <section className="rounded-xl border border-line bg-white">
              <h2 className="border-b border-line px-5 py-3.5 font-extrabold text-ink">
                Newest subscribers
              </h2>
              <div className="p-5 space-y-3">
                {d.recentSubs.length === 0 && (
                  <p className="text-[14px] text-muted">
                    No signups yet. They appear here the moment someone subscribes on the blog.
                  </p>
                )}
                {d.recentSubs.map((s) => (
                  <div key={s.email} className="text-[13px]">
                    <p className="font-semibold text-ink truncate">{s.email}</p>
                    <p className="text-muted">
                      {s.source_path || "—"}
                      {s.country ? ` · ${s.country}` : ""} ·{" "}
                      {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </Shell>
  );
}
