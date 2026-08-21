"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, RotateCcw, Search, SlidersHorizontal } from "lucide-react";

export type FilterOptions = {
  countries: { code: string; name: string }[];
  sources: string[];
  devices: string[];
  posts: { slug: string; title: string }[];
};

const RANGES = [
  { v: "7", label: "7 days" },
  { v: "30", label: "30 days" },
  { v: "90", label: "90 days" },
  { v: "365", label: "12 months" },
  { v: "all", label: "All time" },
];

export function AnalyticsFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const get = (k: string) => params.get(k) ?? "";

  /** Rewrite one query param and reload the server component. */
  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.push(`/analytics?${next.toString()}`));
  };

  const active = ["country", "source", "device", "slug", "q", "from", "to"].filter((k) => get(k));

  return (
    <div className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="inline-flex items-center gap-2 text-[13px] font-extrabold text-ink">
          <SlidersHorizontal size={15} />
          Filter
        </span>

        {/* date range */}
        <div className="flex rounded-lg border border-line overflow-hidden">
          {RANGES.map((r) => {
            const on = (get("days") || "30") === r.v && !get("from");
            return (
              <button
                key={r.v}
                onClick={() => set({ days: r.v, from: "", to: "" })}
                className={`px-3 py-2 text-[13px] font-extrabold transition-colors ${
                  on ? "bg-brand text-white" : "text-ink hover:bg-wash"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* explicit dates override the preset */}
        <div className="flex items-center gap-1.5 text-[13px]">
          <input
            type="date"
            value={get("from")}
            onChange={(e) => set({ from: e.target.value })}
            className="rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-semibold text-ink outline-none focus:border-brand"
          />
          <span className="text-muted">to</span>
          <input
            type="date"
            value={get("to")}
            onChange={(e) => set({ to: e.target.value })}
            className="rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-semibold text-ink outline-none focus:border-brand"
          />
        </div>

        {pending && <Loader2 size={15} className="animate-spin text-brand" />}

        {active.length > 0 && (
          <button
            onClick={() => start(() => router.push("/analytics"))}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] font-extrabold text-muted hover:border-brand hover:text-brand"
          >
            <RotateCcw size={13} />
            Clear {active.length} filter{active.length === 1 ? "" : "s"}
          </button>
        )}
      </div>

      <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Country"
          value={get("country")}
          onChange={(v) => set({ country: v })}
          options={[
            { v: "", label: "All countries" },
            ...options.countries.map((c) => ({ v: c.code, label: c.name })),
          ]}
        />
        <Select
          label="Traffic source"
          value={get("source")}
          onChange={(v) => set({ source: v })}
          options={[
            { v: "", label: "All sources" },
            ...options.sources.map((s) => ({ v: s, label: s })),
          ]}
        />
        <Select
          label="Device"
          value={get("device")}
          onChange={(v) => set({ device: v })}
          options={[
            { v: "", label: "All devices" },
            ...options.devices.map((d) => ({ v: d, label: d })),
          ]}
        />
        <Select
          label="Post"
          value={get("slug")}
          onChange={(v) => set({ slug: v })}
          options={[
            { v: "", label: "All posts" },
            ...options.posts.map((p) => ({ v: p.slug, label: p.title })),
          ]}
        />
      </div>

      <div className="border-t border-line p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); set({ q }); }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search post titles and URLs — e.g. tiktok, bedtime, /blog/best-"
              className="w-full rounded-lg border border-line py-2 pl-9 pr-3 text-[14px] outline-none focus:border-brand"
            />
          </div>
          <button className="rounded-lg bg-brand px-5 py-2 text-[14px] font-extrabold text-white hover:bg-brand-mid">
            Search
          </button>
        </form>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full truncate rounded-lg border border-line bg-white px-3 py-2 text-[14px] font-semibold text-ink outline-none focus:border-brand"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
