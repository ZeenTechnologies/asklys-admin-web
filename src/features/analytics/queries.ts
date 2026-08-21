// Dashboard and analytics reads. Views are defined in db/0001_init.sql.
import "server-only";
import { q, count } from "@/lib/db";

export type PostPerformance = {
  slug: string; title: string; category: string; status: string;
  views: number; visitors: number; store_clicks: number; click_rate_pct: number;
};

export type CountryRow = { country: string; views: number; visitors: number };
export type SourceRow = { source: string; views: number; visitors: number };
export type DailyRow = { day: string; views: number; visitors: number };
export type Subscriber = {
  email: string; source_path: string | null; country: string | null; created_at: string;
};

export const postStatusCounts = () =>
  q<{ status: string; count: string }>(`SELECT status, count(*) FROM posts GROUP BY status`);

export const topPosts = (limit = 8) =>
  q<PostPerformance>(`SELECT * FROM post_performance ORDER BY views DESC LIMIT $1`, [limit]);

// Rows with no geo/referrer are real traffic, so label them rather than dropping them.
export const trafficByCountry = (limit = 6) =>
  q<CountryRow>(
    `SELECT coalesce(country, 'Unknown') as country, views, visitors
       FROM traffic_by_country LIMIT $1`,
    [limit],
  );

export const trafficBySource = (limit = 6) =>
  q<SourceRow>(
    `SELECT coalesce(source, 'direct') as source, views, visitors
       FROM traffic_by_source LIMIT $1`,
    [limit],
  );

export const dailyTraffic = (limit = 30) =>
  q<DailyRow>(`SELECT * FROM daily_traffic LIMIT $1`, [limit]);

export const subscriberCount = () => count(`SELECT count(*) FROM subscribers`);

export const recentSubscribers = (limit = 8) =>
  q<Subscriber>(
    `SELECT email, source_path, country, created_at
       FROM subscribers ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );

// --- the filtered analytics page ------------------------------------------
export type ViewRow = {
  post_slug: string | null; path: string; country: string | null;
  source: string | null; device: string | null; browser: string | null;
  visitor_hash: string | null; created_at: string;
};

export type ClickRow = {
  post_slug: string | null; link_type: string | null; link_url: string;
  country: string | null; source: string | null; created_at: string;
};

export type Filters = {
  from: Date; to: Date;
  country?: string; source?: string; device?: string; slug?: string;
};

// Builds the shared WHERE clause; every filter is a bound parameter.
function where(f: Filters, hasDevice: boolean) {
  const clauses = ["created_at >= $1", "created_at <= $2"];
  const params: unknown[] = [f.from, f.to];
  const add = (col: string, val?: string) => {
    if (!val) return;
    params.push(val);
    clauses.push(`${col} = $${params.length}`);
  };
  add("country", f.country);
  add("source", f.source);
  add("post_slug", f.slug);
  if (hasDevice) add("device", f.device);
  return { sql: clauses.join(" AND "), params };
}

export function filteredViews(f: Filters, cap = 50_000) {
  const { sql, params } = where(f, true);
  return q<ViewRow>(
    `SELECT post_slug, path, country, source, device, browser, visitor_hash, created_at
       FROM pageviews WHERE ${sql}
      ORDER BY created_at DESC LIMIT ${cap}`,
    params,
  );
}

export function filteredClicks(f: Filters, cap = 50_000) {
  // clicks has no device column, so a device filter can't apply here.
  const { sql, params } = where(f, false);
  return q<ClickRow>(
    `SELECT post_slug, link_type, link_url, country, source, created_at
       FROM clicks WHERE ${sql}
      ORDER BY created_at DESC LIMIT ${cap}`,
    params,
  );
}

// Options for the filter dropdowns — deliberately unfiltered, so you can always switch away.
// DISTINCT in SQL rather than de-duplicating a few thousand rows in JS.
export async function filterOptions() {
  const [countries, sources, devices] = await Promise.all([
    q<{ country: string }>(
      `SELECT DISTINCT country FROM pageviews WHERE country IS NOT NULL ORDER BY country LIMIT 60`,
    ),
    q<{ source: string }>(
      `SELECT DISTINCT source FROM pageviews WHERE source IS NOT NULL ORDER BY source LIMIT 30`,
    ),
    q<{ device: string }>(
      `SELECT DISTINCT device FROM pageviews WHERE device IS NOT NULL ORDER BY device`,
    ),
  ]);
  return {
    countries: countries.map((r) => r.country),
    sources: sources.map((r) => r.source),
    devices: devices.map((r) => r.device),
  };
}
