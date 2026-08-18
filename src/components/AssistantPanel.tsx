"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Check, ExternalLink, Link2, Loader2, Search, Sparkles, TrendingUp } from "lucide-react";

type PostLite = { slug: string; title: string; category: string; keywords: string[] | null; status: string };

type Source = {
  title: string; url: string; publisher: string;
  year: number | null; doi: string | null; citedBy: number;
  kind: "paper" | "authority";
};

type Idea = {
  title: string;
  keyword: string;
  intent: string;
  why: string;
  difficulty: "easy" | "medium" | "hard";
};

type LinkSuggestion = { from: string; to: string; anchor: string; why: string };

const DIFFICULTY_STYLE: Record<string, string> = {
  easy: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  hard: "bg-red-50 text-red-700",
};

export function AssistantPanel({ posts }: { posts: PostLite[] }) {
  const [tab, setTab] = useState<"ideas" | "links" | "sources" | "keywords">("ideas");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [links, setLinks] = useState<LinkSuggestion[]>([]);
  const [applied, setApplied] = useState<Record<number, string>>({});
  const [applying, setApplying] = useState<number | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [seed, setSeed] = useState("");

  const published = posts.filter((p) => p.status === "published");
  const [sourceSlug, setSourceSlug] = useState(published[0]?.slug ?? "");
  const [sources, setSources] = useState<Source[]>([]);
  const [cited, setCited] = useState<Record<string, string>>({});
  const [citing, setCiting] = useState<string | null>(null);

  const titles = posts.map((p) => p.title);

  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, existing: titles, ...extra }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Request failed");
      return j;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const findGaps = async () => {
    const j = await run("gaps");
    if (j?.ideas) setIdeas(j.ideas);
  };

  const suggestLinks = async () => {
    const j = await run("links", {
      posts: posts.filter((p) => p.status === "published").map((p) => ({ slug: p.slug, title: p.title })),
    });
    if (j?.links) setLinks(j.links);
  };

  const applyLink = async (l: LinkSuggestion, i: number) => {
    setApplying(i);
    setErr(null);
    try {
      const res = await fetch("/api/apply-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromTitle: l.from, toTitle: l.to, anchor: l.anchor }),
      });
      const j = await res.json();
      if (!j.ok) {
        setApplied((a) => ({ ...a, [i]: "failed" }));
        setErr(j.error ?? "Could not insert the link.");
      } else {
        setApplied((a) => ({ ...a, [i]: j.status === "already" ? "already" : "done" }));
      }
    } catch {
      setErr("Could not insert the link.");
    } finally {
      setApplying(null);
    }
  };

  const applyAll = async () => {
    for (let i = 0; i < links.length; i++) {
      if (!applied[i]) await applyLink(links[i], i);
    }
  };

  // ---- external sources ----
  const findSources = async () => {
    const post = posts.find((p) => p.slug === sourceSlug);
    if (!post) return setErr("Pick a published post first.");
    setSources([]);
    setCited({});
    const j = await run("sources", { title: post.title, keywords: post.keywords ?? [] });
    if (j?.sources) {
      setSources(j.sources);
      if (j.sources.length === 0) setErr("No sources came back — try a post with a clearer topic.");
    }
  };

  const cite = async (s: Source, i: number) => {
    setCiting(String(i));
    setErr(null);
    try {
      const res = await fetch("/api/cite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: sourceSlug,
          url: s.url, title: s.title, publisher: s.publisher,
          year: s.year, doi: s.doi, mode: "sources",
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Could not add the source.");
      setCited((c) => ({ ...c, [i]: j.status }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add the source.");
    } finally {
      setCiting(null);
    }
  };

  const expandKeywords = async () => {
    if (!seed.trim()) return setErr("Type a topic first.");
    const j = await run("keywords", { seed });
    if (j?.keywords) setKeywords(j.keywords);
  };

  return (
    <div className="p-8 space-y-6">
      {/* tabs */}
      <div className="flex gap-2">
        {([
          { id: "ideas", label: "What to write next", icon: TrendingUp },
          { id: "links", label: "Internal links", icon: Link2 },
          { id: "sources", label: "External sources", icon: BookOpen },
          { id: "keywords", label: "Keyword expander", icon: Search },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-extrabold transition-colors ${
              tab === id ? "bg-brand text-white" : "border border-line bg-white text-ink hover:border-brand"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
          {err}
        </div>
      )}

      {/* ---- content gaps ---- */}
      {tab === "ideas" && (
        <section className="rounded-xl border border-line bg-white p-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="font-extrabold text-ink text-lg">What to write next</h2>
              <p className="mt-1 text-[15px] text-muted">
                Looks at your {posts.length} existing posts and finds the searches parents make that
                you haven&apos;t covered yet.
              </p>
            </div>
            <button
              onClick={findGaps}
              disabled={busy}
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-mid disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Find gaps
            </button>
          </div>

          {ideas.length > 0 && (
            <div className="mt-6 space-y-3">
              {ideas.map((idea, i) => (
                <div key={i} className="rounded-lg border border-line p-4">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-extrabold text-ink">{idea.title}</h3>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase ${DIFFICULTY_STYLE[idea.difficulty] ?? "bg-wash text-muted"}`}>
                      {idea.difficulty}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[14px] text-body">{idea.why}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[13px]">
                    <code className="rounded bg-wash px-2 py-1 font-semibold text-brand">{idea.keyword}</code>
                    <span className="text-muted capitalize">{idea.intent} intent</span>
                    <Link
                      href={`/posts/new?title=${encodeURIComponent(idea.title)}`}
                      className="ml-auto font-extrabold text-brand hover:underline"
                    >
                      Write this →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---- internal links ---- */}
      {tab === "links" && (
        <section className="rounded-xl border border-line bg-white p-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="font-extrabold text-ink text-lg">Internal link suggestions</h2>
              <p className="mt-1 text-[15px] text-muted">
                Linking related posts together is one of the few on-page things that genuinely moves
                rankings. This finds the links you&apos;re missing.
              </p>
            </div>
            <button
              onClick={suggestLinks}
              disabled={busy}
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-mid disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Suggest links
            </button>
          </div>

          {links.length > 0 && (
            <div className="mt-5">
              <button
                onClick={applyAll}
                disabled={applying !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-brand px-4 py-2 text-[13px] font-extrabold text-brand hover:bg-brand hover:text-white disabled:opacity-50"
              >
                <Link2 size={14} />
                Apply all
              </button>
            </div>
          )}

          {links.length > 0 && (
            <div className="mt-4 space-y-3">
              {links.map((l, i) => (
                <div key={i} className="rounded-lg border border-line p-4">
                  <p className="text-[14px] text-body">
                    In <strong className="text-ink">{l.from}</strong>, link the phrase{" "}
                    <span className="rounded bg-brand/10 px-1.5 py-0.5 font-bold text-brand">{l.anchor}</span>{" "}
                    to <strong className="text-ink">{l.to}</strong>
                  </p>
                  <div className="mt-2.5 flex items-center gap-3">
                    <p className="text-[13px] text-muted flex-1">{l.why}</p>
                    {applied[i] === "done" || applied[i] === "already" ? (
                      <span className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-extrabold text-emerald-600">
                        <Check size={14} />
                        {applied[i] === "already" ? "Already linked" : "Added to post"}
                      </span>
                    ) : (
                      <button
                        onClick={() => applyLink(l, i)}
                        disabled={applying !== null}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-[13px] font-extrabold text-white hover:bg-brand-mid disabled:opacity-50"
                      >
                        {applying === i ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                        Apply
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---- external sources ---- */}
      {tab === "sources" && (
        <section className="rounded-xl border border-line bg-white p-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="font-extrabold text-ink text-lg">External sources</h2>
              <p className="mt-1 text-[15px] text-muted">
                Real research and public-health pages you can cite. Linking out to authoritative
                sources is what makes a claim credible — to readers and to Google.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <select
              value={sourceSlug}
              onChange={(e) => setSourceSlug(e.target.value)}
              className="flex-1 min-w-[240px] rounded-lg border border-line bg-white px-4 py-2.5 text-[15px] font-semibold text-ink outline-none focus:border-brand"
            >
              {published.length === 0 && <option value="">Publish a post first</option>}
              {published.map((p) => (
                <option key={p.slug} value={p.slug}>{p.title}</option>
              ))}
            </select>
            <button
              onClick={findSources}
              disabled={busy || !sourceSlug}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-mid disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
              Find sources
            </button>
          </div>

          <p className="mt-3 rounded-lg bg-wash px-3.5 py-2.5 text-[12px] leading-relaxed text-muted">
            Papers come from OpenAlex, a free catalogue of 250M+ published works — the AI only picks
            the search terms, so nothing here is an invented citation. Always open a source before
            you cite it.
          </p>

          {sources.length > 0 && (
            <div className="mt-5 space-y-3">
              {sources.map((s, i) => (
                <div key={i} className="rounded-lg border border-line p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                          s.kind === "authority" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"
                        }`}>
                          {s.kind === "authority" ? "Authority" : "Peer-reviewed"}
                        </span>
                        {s.citedBy > 0 && (
                          <span className="text-[11px] font-bold text-muted">
                            cited {s.citedBy.toLocaleString()}×
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1.5 font-extrabold text-ink leading-snug">{s.title}</h3>
                      <p className="mt-1 text-[13px] text-muted">
                        {[s.publisher, s.year].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener"
                        className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-extrabold text-brand hover:underline"
                      >
                        Open source <ExternalLink size={12} />
                      </a>
                    </div>

                    {cited[i] ? (
                      <span className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-extrabold text-emerald-600">
                        <Check size={14} />
                        {cited[i] === "already" ? "Already cited" : "Added"}
                      </span>
                    ) : (
                      <button
                        onClick={() => cite(s, i)}
                        disabled={citing !== null}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-[13px] font-extrabold text-white hover:bg-brand-mid disabled:opacity-50"
                      >
                        {citing === String(i) ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                        Cite it
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---- keyword expander ---- */}
      {tab === "keywords" && (
        <section className="rounded-xl border border-line bg-white p-6">
          <h2 className="font-extrabold text-ink text-lg">Keyword expander</h2>
          <p className="mt-1 text-[15px] text-muted">
            Give it a topic and it returns the long-tail searches parents actually type — the ones
            worth building a post around.
          </p>

          <div className="mt-4 flex gap-3">
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && expandKeywords()}
              placeholder="e.g. bedtime phone rules"
              className="flex-1 rounded-lg border border-line px-4 py-2.5 text-[15px] outline-none focus:border-brand"
            />
            <button
              onClick={expandKeywords}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-mid disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Expand
            </button>
          </div>

          {keywords.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {keywords.map((k) => (
                <span key={k} className="rounded-full bg-wash px-3.5 py-1.5 text-[14px] font-semibold text-ink">
                  {k}
                </span>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
