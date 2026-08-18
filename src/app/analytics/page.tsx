import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { Shell, PageHead } from "@/components/Shell";
import { BarList, TrafficChart } from "@/components/Charts";
import { AnalyticsFilters } from "@/components/AnalyticsFilters";
import { COUNTRY_NAMES } from "@/lib/countries";

export const dynamic = "force-dynamic";

/**
 * Filtered analytics.
 *
 * The pre-aggregated SQL views can't answer "UK visitors from Pinterest on
 * mobile", so once a filter is on we read the raw rows for the window and
 * aggregate here. At this traffic level that is a single fast query; the cap
 * below exists only so a runaway month can't blow up the page.
 */
const ROW_CAP = 50_000;

type Search = {
  days?: string; from?: string; to?: string;
  country?: string; source?: string; device?: string; slug?: string; q?: string;
};

type View = {
  post_slug: string | null; path: string; country: string | null;
  source: string | null; device: string | null; browser: string | null;
  visitor_hash: string | null; created_at: string;
};

type Click = {
  post_slug: string | null; link_type: string | null; link_url: string;
  country: string | null; source: string | null; created_at: string;
};

const dayKey = (iso: string) => iso.slice(0, 10);

function tally<T>(rows: T[], key: (r: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireAuth();
  const sp = await searchParams;

  // ---- window ----
  const preset = sp.days ?? "30";
  const from = sp.from
    ? new Date(`${sp.from}T00:00:00Z`)
    : preset === "all"
      ? new Date("2000-01-01")
      : new Date(Date.now() - Number(preset) * 864e5);
  const to = sp.to ? new Date(`${sp.to}T23:59:59Z`) : new Date();

  const db = supabaseAdmin();

  // ---- filtered raw rows ----
  let vq = db
    .from("pageviews")
    .select("post_slug,path,country,source,device,browser,visitor_hash,created_at")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: false })
    .limit(ROW_CAP);

  let cq = db
    .from("clicks")
    .select("post_slug,link_type,link_url,country,source,created_at")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: false })
    .limit(ROW_CAP);

  if (sp.country) { vq = vq.eq("country", sp.country); cq = cq.eq("country", sp.country); }
  if (sp.source)  { vq = vq.eq("source", sp.source);   cq = cq.eq("source", sp.source); }
  if (sp.device)  { vq = vq.eq("device", sp.device); }
  if (sp.slug)    { vq = vq.eq("post_slug", sp.slug);  cq = cq.eq("post_slug", sp.slug); }

  const [viewsRes, clicksRes, postsRes] = await Promise.all([
    vq,
    cq,
    db.from("posts").select("slug,title,category").order("title"),
  ]);

  const posts = (postsRes.data ?? []) as { slug: string; title: string; category: string }[];
  const titleOf = new Map(posts.map((p) => [p.slug, p.title]));
  const catOf = new Map(posts.map((p) => [p.slug, p.category]));

  // ---- free-text search runs over the joined title + path ----
  const needle = (sp.q ?? "").trim().toLowerCase();
  const matches = (slug: string | null, path: string) =>
    !needle ||
    path.toLowerCase().includes(needle) ||
    (slug ?? "").toLowerCase().includes(needle) ||
    (titleOf.get(slug ?? "") ?? "").toLowerCase().includes(needle);

  const views = ((viewsRes.data ?? []) as View[]).filter((v) => matches(v.post_slug, v.path));
  const clicks = ((clicksRes.data ?? []) as Click[]).filter((c) =>
    matches(c.post_slug, c.post_slug ? `/blog/${c.post_slug}` : ""),
  );

  const storeClicks = clicks.filter((c) => c.link_type === "app_store" || c.link_type === "play_store");
  const visitors = new Set(views.map((v) => v.visitor_hash).filter(Boolean)).size;
  const convPct = views.length ? (storeClicks.length / views.length) * 100 : 0;

  // ---- daily series ----
  const byDay = new Map<string, { views: number; vis: Set<string> }>();
  for (const v of views) {
    const k = dayKey(v.created_at);
    const e = byDay.get(k) ?? { views: 0, vis: new Set<string>() };
    e.views++;
    if (v.visitor_hash) e.vis.add(v.visitor_hash);
    byDay.set(k, e);
  }
  const chart = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, e]) => ({ day, views: e.views, visitors: e.vis.size }));

  // ---- breakdowns ----
  const countryRows = tally(views, (v) => v.country)
    .slice(0, 12)
    .map(([code, n]) => ({ country: COUNTRY_NAMES[code] ?? code, views: n }));
  const sourceRows = tally(views, (v) => v.source ?? "direct")
    .slice(0, 10)
    .map(([source, n]) => ({ source, views: n }));
  const deviceRows = tally(views, (v) => v.device)
    .map(([device, n]) => ({ device, views: n }));
  const browserRows = tally(views, (v) => v.browser)
    .slice(0, 6)
    .map(([browser, n]) => ({ browser, views: n }));

  // ---- per-post funnel, respecting every filter ----
  const perPost = new Map<string, { views: number; vis: Set<string>; clicks: number }>();
  for (const v of views) {
    if (!v.post_slug) continue;
    const e = perPost.get(v.post_slug) ?? { views: 0, vis: new Set<string>(), clicks: 0 };
    e.views++;
    if (v.visitor_hash) e.vis.add(v.visitor_hash);
    perPost.set(v.post_slug, e);
  }
  for (const c of storeClicks) {
    if (!c.post_slug) continue;
    const e = perPost.get(c.post_slug) ?? { views: 0, vis: new Set<string>(), clicks: 0 };
    e.clicks++;
    perPost.set(c.post_slug, e);
  }
  const perf = [...perPost.entries()]
    .map(([slug, e]) => ({
      slug,
      title: titleOf.get(slug) ?? slug,
      category: catOf.get(slug) ?? "—",
      views: e.views,
      visitors: e.vis.size,
      clicks: e.clicks,
      rate: e.views ? (e.clicks / e.views) * 100 : 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 30);

  // ---- filter dropdown options (unfiltered, so you can always switch) ----
  const [allCountries, allSources, allDevices] = await Promise.all([
    db.from("traffic_by_country").select("country").limit(60),
    db.from("traffic_by_source").select("source").limit(30),
    db.from("pageviews").select("device").limit(2000),
  ]);
  const options = {
    countries: (allCountries.data ?? [])
      .map((r) => (r as { country: string }).country)
      .filter(Boolean)
      .map((code) => ({ code, name: COUNTRY_NAMES[code] ?? code })),
    sources: (allSources.data ?? []).map((r) => (r as { source: string }).source).filter(Boolean),
    devices: [...new Set((allDevices.data ?? []).map((r) => (r as { device: string }).device).filter(Boolean))],
    posts: posts.map((p) => ({ slug: p.slug, title: p.title })),
  };

  const capped = views.length >= ROW_CAP;
  const filterLabel = [
    sp.country && (COUNTRY_NAMES[sp.country] ?? sp.country),
    sp.source, sp.device,
    sp.slug && titleOf.get(sp.slug),
    sp.q && `“${sp.q}”`,
  ].filter(Boolean).join(" · ");

  return (
    <Shell>
      <PageHead
        title="Analytics"
        subtitle={filterLabel || "Where readers come from, and what makes them click through to the app."}
      />

      <div className="p-8 space-y-8">
        <AnalyticsFilters options={options} />

        {capped && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
            Showing the most recent {ROW_CAP.toLocaleString()} views for this window. Narrow the date
            range for exact totals.
          </p>
        )}

        {/* headline numbers for the current filter */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Page views" value={views.length.toLocaleString()} />
          <Stat label="Visitors" value={visitors.toLocaleString()} />
          <Stat label="Store clicks" value={storeClicks.length.toLocaleString()} />
          <Stat label="Conversion" value={`${convPct.toFixed(2)}%`} accent />
        </div>

        {views.length === 0 ? (
          <section className="rounded-xl border border-dashed border-line bg-white p-12 text-center">
            <h2 className="font-extrabold text-ink text-lg">Nothing matches those filters</h2>
            <p className="mt-2 text-[15px] text-muted">
              Try widening the date range or clearing a filter.
            </p>
          </section>
        ) : (
          <>
            <section className="rounded-xl border border-line bg-white p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-extrabold text-ink">Traffic</h2>
                <p className="text-[13px] text-muted">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-brand align-middle mr-1.5" />
                  Views
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent align-middle ml-4 mr-1.5" />
                  Visitors
                </p>
              </div>
              <div className="mt-4">
                <TrafficChart data={chart} />
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-4">
              <Panel title="Countries"><BarList rows={countryRows} labelKey="country" /></Panel>
              <Panel title="Sources"><BarList rows={sourceRows} labelKey="source" /></Panel>
              <Panel title="Devices"><BarList rows={deviceRows} labelKey="device" /></Panel>
              <Panel title="Browsers"><BarList rows={browserRows} labelKey="browser" /></Panel>
            </div>

            <section className="rounded-xl border border-line bg-white overflow-hidden">
              <div className="border-b border-line px-5 py-3.5 flex items-baseline justify-between">
                <h2 className="font-extrabold text-ink">Post performance</h2>
                <p className="text-[13px] text-muted">
                  {views.length.toLocaleString()} views → {storeClicks.length.toLocaleString()} store
                  clicks ({convPct.toFixed(1)}%)
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[14px]">
                  <thead className="bg-wash text-left">
                    <tr>
                      <th className="px-5 py-2.5 font-extrabold text-ink">Post</th>
                      <th className="px-3 py-2.5 font-extrabold text-ink">Views</th>
                      <th className="px-3 py-2.5 font-extrabold text-ink">Visitors</th>
                      <th className="px-3 py-2.5 font-extrabold text-ink">Store clicks</th>
                      <th className="px-5 py-2.5 font-extrabold text-ink">Conversion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perf.map((r) => (
                      <tr key={r.slug} className="border-t border-line">
                        <td className="px-5 py-3">
                          <Link href={`/posts/${r.slug}`} className="font-bold text-ink hover:text-brand line-clamp-1">
                            {r.title}
                          </Link>
                          <span className="text-[12px] text-muted">{r.category}</span>
                        </td>
                        <td className="px-3 py-3 text-body">{r.views.toLocaleString()}</td>
                        <td className="px-3 py-3 text-body">{r.visitors.toLocaleString()}</td>
                        <td className="px-3 py-3 text-body">{r.clicks.toLocaleString()}</td>
                        <td className="px-5 py-3">
                          <span className={`font-extrabold ${r.rate > 0 ? "text-brand" : "text-muted"}`}>
                            {r.rate.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-line bg-white overflow-hidden">
              <h2 className="border-b border-line px-5 py-3.5 font-extrabold text-ink">
                Recent outbound clicks
              </h2>
              {clicks.length === 0 ? (
                <p className="p-5 text-[15px] text-muted">No clicks match these filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-[14px]">
                    <thead className="bg-wash text-left">
                      <tr>
                        <th className="px-5 py-2.5 font-extrabold text-ink">Type</th>
                        <th className="px-3 py-2.5 font-extrabold text-ink">From post</th>
                        <th className="px-3 py-2.5 font-extrabold text-ink">Country</th>
                        <th className="px-3 py-2.5 font-extrabold text-ink">Source</th>
                        <th className="px-5 py-2.5 font-extrabold text-ink">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clicks.slice(0, 20).map((c, i) => {
                        const isStore = c.link_type === "app_store" || c.link_type === "play_store";
                        return (
                          <tr key={i} className="border-t border-line">
                            <td className="px-5 py-3">
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase ${
                                isStore ? "bg-emerald-50 text-emerald-700" : "bg-wash text-muted"
                              }`}>
                                {c.link_type?.replace("_", " ") ?? "link"}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-body line-clamp-1">
                              {titleOf.get(c.post_slug ?? "") ?? c.post_slug ?? "—"}
                            </td>
                            <td className="px-3 py-3 text-body">
                              {COUNTRY_NAMES[c.country ?? ""] ?? c.country ?? "—"}
                            </td>
                            <td className="px-3 py-3 text-body">{c.source ?? "direct"}</td>
                            <td className="px-5 py-3 text-muted">
                              {new Date(c.created_at).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <p className="text-[12px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1.5 text-3xl font-extrabold tracking-tight ${accent ? "text-brand" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="font-extrabold text-ink mb-4">{title}</h2>
      {children}
    </section>
  );
}
