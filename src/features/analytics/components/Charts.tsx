"use client";

import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type Row = { day: string; views: number; visitors: number };

export function TrafficChart({ data }: { data: Row[] }) {
  if (!data.length) {
    return (
      <div className="grid h-[260px] place-items-center text-[14px] text-muted">
        No traffic recorded yet.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6B5CE7" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#6B5CE7" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gVisitors" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5A623" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#F5A623" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E7E4EE" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: "#6E6980" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(d: string) =>
            new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
          }
        />
        <YAxis tick={{ fontSize: 11, fill: "#6E6980" }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: "1px solid #E7E4EE", fontSize: 13 }}
          labelFormatter={(d) => new Date(String(d)).toLocaleDateString("en-GB", { dateStyle: "medium" })}
        />
        <Area type="monotone" dataKey="views" stroke="#6B5CE7" strokeWidth={2} fill="url(#gViews)" name="Views" />
        <Area type="monotone" dataKey="visitors" stroke="#F5A623" strokeWidth={2} fill="url(#gVisitors)" name="Visitors" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bar list — used for countries and sources. */
export function BarList({
  rows,
  labelKey,
  emptyText = "No data yet.",
}: {
  rows: Record<string, string | number>[];
  labelKey: string;
  emptyText?: string;
}) {
  if (!rows.length) return <p className="text-[14px] text-muted">{emptyText}</p>;
  const max = Math.max(...rows.map((r) => Number(r.views) || 0), 1);

  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const label = String(r[labelKey] ?? "—");
        const views = Number(r.views) || 0;
        return (
          <div key={label} className="relative">
            <div
              className="absolute inset-y-0 left-0 rounded bg-brand/10"
              style={{ width: `${(views / max) * 100}%` }}
            />
            <div className="relative flex justify-between px-2.5 py-1.5 text-[14px]">
              <span className="font-semibold text-ink capitalize">{label}</span>
              <span className="text-muted">{views.toLocaleString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
