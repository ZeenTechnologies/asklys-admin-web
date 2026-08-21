"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight, Check, ExternalLink, Loader2, Plus, RefreshCw, Sparkles, Trash2,
} from "lucide-react";

export type { Backlink, ReferringDomain } from "../queries";
import type { Backlink, ReferringDomain } from "../queries";

type Target = {
  name: string; type: string; why: string; pitch: string; effort: "low" | "medium" | "high";
};

const STATUSES = ["idea", "contacted", "replied", "live", "rejected"];

const STATUS_STYLE: Record<string, string> = {
  idea: "bg-wash text-muted",
  contacted: "bg-amber-50 text-amber-700",
  replied: "bg-sky-50 text-sky-700",
  live: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
};

const EFFORT_STYLE: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
};

const blank = (): Partial<Backlink> => ({
  domain: "", url: "", target_path: "", anchor: "",
  kind: "manual", status: "idea", authority: null, dofollow: true, notes: "",
});

export function BacklinksPanel({
  links,
  referrers,
  postTitles,
}: {
  links: Backlink[];
  referrers: ReferringDomain[];
  postTitles: string[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"tracker" | "detected" | "ideas">("tracker");
  const [draft, setDraft] = useState<Partial<Backlink> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);

  const call = async (payload: Record<string, unknown>, tag: string) => {
    setBusy(tag);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/backlinks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      return j;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    const j = await call({ action: "sync" }, "sync");
    if (!j) return;
    setMsg(
      j.added > 0
        ? `Found ${j.added} new referring domain${j.added === 1 ? "" : "s"} from real traffic.`
        : `Scanned ${j.scanned} referrers — ${j.linked} are genuine backlinks, nothing new since last check.`,
    );
    router.refresh();
  };

  const save = async () => {
    if (!draft?.domain) return setErr("A domain is required.");
    const j = await call(draft as Record<string, unknown>, "save");
    if (!j) return;
    setDraft(null);
    setMsg("Saved.");
    router.refresh();
  };

  const remove = async (id: string) => {
    if (await call({ action: "delete", id }, `del-${id}`)) router.refresh();
  };

  const findTargets = async () => {
    setBusy("ideas");
    setErr(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "outreach", existing: postTitles }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      setTargets(j.targets ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const addTarget = async (t: Target) => {
    const j = await call(
      { domain: t.name.toLowerCase().replace(/\s+/g, "-"), status: "idea", kind: "manual", notes: `${t.type} — ${t.pitch}` },
      `add-${t.name}`,
    );
    if (j) { setMsg(`Added "${t.name}" to the tracker.`); router.refresh(); }
  };

  const live = links.filter((l) => l.status === "live");
  const totalReferrals = links.reduce((s, l) => s + (l.referrals ?? 0), 0);

  return (
    <div className="p-8 space-y-6">
      {/* headline */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Live backlinks" value={String(live.length)} />
        <Stat label="Referring domains seen" value={String(referrers.length)} />
        <Stat label="Sessions from backlinks" value={totalReferrals.toLocaleString()} accent />
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] font-semibold text-emerald-800">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
          {err}
        </div>
      )}

      {/* tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          { id: "tracker", label: `Tracker (${links.length})` },
          { id: "detected", label: `Detected from traffic (${referrers.length})` },
          { id: "ideas", label: "Where to get links" },
        ] as const).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-lg px-4 py-2.5 text-[14px] font-extrabold transition-colors ${
              tab === id ? "bg-brand text-white" : "border border-line bg-white text-ink hover:border-brand"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------- tracker */}
      {tab === "tracker" && (
        <section className="rounded-xl border border-line bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-extrabold text-ink">Backlink tracker</h2>
              <p className="text-[13px] text-muted">
                Every site linking to you, plus the ones you&apos;re still chasing.
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                onClick={sync}
                disabled={!!busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand px-3.5 py-2 text-[13px] font-extrabold text-brand hover:bg-brand hover:text-white disabled:opacity-50"
              >
                {busy === "sync" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Sync from traffic
              </button>
              <button
                onClick={() => setDraft(blank())}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-extrabold text-white hover:bg-brand-mid"
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          </div>

          {draft && (
            <div className="border-b border-line bg-wash p-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <L label="Domain"><input value={draft.domain ?? ""} onChange={(e) => setDraft({ ...draft, domain: e.target.value })} placeholder="mumsnet.com" className={input} /></L>
                <L label="Linking page URL"><input value={draft.url ?? ""} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" className={input} /></L>
                <L label="Points at"><input value={draft.target_path ?? ""} onChange={(e) => setDraft({ ...draft, target_path: e.target.value })} placeholder="/blog/best-parental-control-apps" className={input} /></L>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <L label="Anchor text"><input value={draft.anchor ?? ""} onChange={(e) => setDraft({ ...draft, anchor: e.target.value })} className={input} /></L>
                <L label="Status">
                  <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className={input}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </L>
                <L label="Authority (0-100)"><input type="number" value={draft.authority ?? ""} onChange={(e) => setDraft({ ...draft, authority: e.target.value === "" ? null : Number(e.target.value) })} className={input} /></L>
                <L label="Follow">
                  <select value={draft.dofollow ? "1" : "0"} onChange={(e) => setDraft({ ...draft, dofollow: e.target.value === "1" })} className={input}>
                    <option value="1">dofollow</option>
                    <option value="0">nofollow</option>
                  </select>
                </L>
              </div>
              <L label="Notes"><textarea value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} className={input} /></L>
              <div className="flex gap-2">
                <button onClick={save} disabled={!!busy} className="rounded-lg bg-brand px-5 py-2 text-[14px] font-extrabold text-white hover:bg-brand-mid disabled:opacity-50">
                  {busy === "save" ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setDraft(null)} className="rounded-lg border border-line px-5 py-2 text-[14px] font-extrabold text-ink hover:border-brand">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {links.length === 0 ? (
            <p className="p-8 text-center text-[15px] text-muted">
              Nothing tracked yet. Hit <strong className="text-ink">Sync from traffic</strong> to pull
              in every site that has actually sent you a visitor.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[14px]">
                <thead className="bg-wash text-left">
                  <tr>
                    <th className="px-5 py-2.5 font-extrabold text-ink">Domain</th>
                    <th className="px-3 py-2.5 font-extrabold text-ink">Status</th>
                    <th className="px-3 py-2.5 font-extrabold text-ink">Points at</th>
                    <th className="px-3 py-2.5 font-extrabold text-ink">Sessions</th>
                    <th className="px-3 py-2.5 font-extrabold text-ink">Auth</th>
                    <th className="px-5 py-2.5 font-extrabold text-ink"></th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => (
                    <tr key={l.id} className="border-t border-line align-top">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-ink">{l.domain}</span>
                          {l.url && (
                            <a href={l.url} target="_blank" rel="noopener" className="text-muted hover:text-brand">
                              <ExternalLink size={13} />
                            </a>
                          )}
                          {l.kind === "detected" && (
                            <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-brand">
                              verified
                            </span>
                          )}
                          {!l.dofollow && (
                            <span className="rounded bg-wash px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted">
                              nofollow
                            </span>
                          )}
                        </div>
                        {l.notes && <p className="mt-1 text-[12px] text-muted line-clamp-2">{l.notes}</p>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase ${STATUS_STYLE[l.status] ?? "bg-wash text-muted"}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-body">{l.target_path ?? "—"}</td>
                      <td className="px-3 py-3 font-bold text-ink">{(l.referrals ?? 0).toLocaleString()}</td>
                      <td className="px-3 py-3 text-body">{l.authority ?? "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setDraft(l)} className="text-[13px] font-extrabold text-brand hover:underline">
                            Edit
                          </button>
                          <button onClick={() => remove(l.id)} className="text-muted hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------ detected */}
      {tab === "detected" && (
        <section className="rounded-xl border border-line bg-white overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-extrabold text-ink">Referring domains</h2>
            <p className="text-[13px] text-muted">
              Pulled from real visits. Search engines and your own domain are filtered out, so
              everything here is a genuine inbound link somebody clicked.
            </p>
          </div>
          {referrers.length === 0 ? (
            <p className="p-8 text-center text-[15px] text-muted">
              No external referrers recorded yet. They appear as soon as someone reaches the blog
              from another site.
            </p>
          ) : (
            <table className="w-full text-[14px]">
              <thead className="bg-wash text-left">
                <tr>
                  <th className="px-5 py-2.5 font-extrabold text-ink">Domain</th>
                  <th className="px-3 py-2.5 font-extrabold text-ink">Sessions</th>
                  <th className="px-3 py-2.5 font-extrabold text-ink">Visitors</th>
                  <th className="px-3 py-2.5 font-extrabold text-ink">Landing pages</th>
                  <th className="px-5 py-2.5 font-extrabold text-ink">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {referrers.map((r) => (
                  <tr key={r.domain} className="border-t border-line">
                    <td className="px-5 py-3 font-bold text-ink">{r.domain}</td>
                    <td className="px-3 py-3 text-body">{r.sessions.toLocaleString()}</td>
                    <td className="px-3 py-3 text-body">{r.visitors.toLocaleString()}</td>
                    <td className="px-3 py-3 text-body">{r.landing_pages}</td>
                    <td className="px-5 py-3 text-muted">{new Date(r.last_seen).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* --------------------------------------------------------- ideas */}
      {tab === "ideas" && (
        <section className="rounded-xl border border-line bg-white p-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="font-extrabold text-ink text-lg">Where to get links</h2>
              <p className="mt-1 text-[15px] text-muted">
                Realistic outreach targets for a site your size, based on what you&apos;ve published.
              </p>
            </div>
            <button
              onClick={findTargets}
              disabled={!!busy}
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-mid disabled:opacity-50"
            >
              {busy === "ideas" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Find targets
            </button>
          </div>

          {targets.length > 0 && (
            <div className="mt-6 space-y-3">
              {targets.map((t, i) => (
                <div key={i} className="rounded-lg border border-line p-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-extrabold text-ink">{t.name}</h3>
                    <span className="rounded-full bg-wash px-2.5 py-1 text-[11px] font-extrabold uppercase text-muted">
                      {t.type}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase ${EFFORT_STYLE[t.effort] ?? "bg-wash text-muted"}`}>
                      {t.effort} effort
                    </span>
                    <button
                      onClick={() => addTarget(t)}
                      disabled={!!busy}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-brand px-3 py-1.5 text-[13px] font-extrabold text-brand hover:bg-brand hover:text-white disabled:opacity-50"
                    >
                      {busy === `add-${t.name}` ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpRight size={13} />}
                      Track this
                    </button>
                  </div>
                  <p className="mt-2 text-[14px] text-body">{t.why}</p>
                  <p className="mt-2 rounded-lg bg-wash px-3 py-2 text-[13px] italic text-ink">
                    “{t.pitch}”
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-lg border border-line bg-wash p-4">
            <p className="text-[13px] font-extrabold text-ink flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600" />
              One rule worth keeping
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-body">
              Never buy links or post the same guest article to a network of sites. Google&apos;s link
              spam systems catch it, and the penalty removes the traffic you already had. Slow,
              genuine links from a handful of real parenting sites are worth more than fifty
              directory listings.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

const input = "w-full rounded-lg border border-line px-3 py-2 text-[14px] outline-none focus:border-brand bg-white";

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold text-muted">{label}</span>
      {children}
    </label>
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
