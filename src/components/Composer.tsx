"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import {
  CATEGORIES, CARD_STYLES, FONT_STYLES, POST_TYPES, slugify,
  type CardStyle, type FAQItem, type FontStyle, type Post, type PostType,
} from "@/lib/types";
import { Eye, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { CoverPicker } from "./CoverPicker";

type Props = { initial?: Partial<Post> };

export function Composer({ initial }: Props) {
  const router = useRouter();

  // ---- fields ----
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [category, setCategory] = useState(initial?.category ?? "screen-time");
  const [postType, setPostType] = useState<PostType>((initial?.post_type as PostType) ?? "article");
  const [cardStyle, setCardStyle] = useState<CardStyle>((initial?.card_style as CardStyle) ?? "standard");
  const [fontStyle, setFontStyle] = useState<FontStyle>((initial?.font_style as FontStyle) ?? "default");
  const [cover, setCover] = useState(initial?.cover_image ?? "");
  const [coverAlt, setCoverAlt] = useState(initial?.cover_alt ?? "");
  const [featured, setFeatured] = useState(Boolean(initial?.featured));
  const [seoTitle, setSeoTitle] = useState(initial?.seo_title ?? "");
  const [seoDesc, setSeoDesc] = useState(initial?.seo_description ?? "");
  const [keywords, setKeywords] = useState((initial?.keywords ?? []).join(", "));
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [faq, setFaq] = useState<FAQItem[]>((initial?.faq as FAQItem[]) ?? []);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // set when the server rejects a duplicate slug and offers a free alternative
  const [slugFix, setSlugFix] = useState<string | null>(null);

  const editor = useCreateBlockNote({
    initialContent: (initial?.body_json as never) ?? undefined,
  });

  // The markdown in body_html is the source of truth (the internal-link tool
  // edits it directly), so re-parse it on open when there's no editor JSON.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    const md = initial?.body_html;
    if (!initial?.body_json && md) {
      // returns blocks directly in some versions, a promise in others
      void (async () => {
        const blocks = await Promise.resolve(editor.tryParseMarkdownToBlocks(md));
        if (blocks?.length) editor.replaceBlocks(editor.document, blocks);
      })();
    }
    setHydrated(true);
  }, [editor, initial?.body_json, initial?.body_html, hydrated]);

  const onTitle = (v: string) => {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  // ---- AI helpers ----
  const callAi = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      setBusy(action);
      setMsg(null);
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, title, category, postType, keywords, ...extra }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "AI request failed");
        return j;
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "AI failed");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [title, category, postType, keywords],
  );

  const draftPost = async () => {
    const j = await callAi("draft");
    if (!j) return;
    if (j.excerpt) setExcerpt(j.excerpt);
    if (j.markdown) {
      const blocks = await editor.tryParseMarkdownToBlocks(j.markdown);
      editor.replaceBlocks(editor.document, blocks);
    }
    setMsg("Draft written — review it before publishing.");
  };

  const genSeo = async () => {
    const j = await callAi("seo", { excerpt });
    if (!j) return;
    if (j.seoTitle) setSeoTitle(j.seoTitle);
    if (j.seoDescription) setSeoDesc(j.seoDescription);
    if (j.keywords?.length) setKeywords(j.keywords.join(", "));
    setMsg("SEO fields generated.");
  };

  const genFaq = async () => {
    const j = await callAi("faq", { excerpt });
    if (j?.faq?.length) {
      setFaq(j.faq);
      setMsg(`${j.faq.length} FAQs generated — they become rich-results schema.`);
    }
  };

  // ---- shared payload ----
  const payload = async (extra: Record<string, unknown> = {}) => ({
    id: initial?.id,
    slug: slug || slugify(title),
    title, excerpt, category,
    post_type: postType, card_style: cardStyle, font_style: fontStyle,
    cover_image: cover, cover_alt: coverAlt, featured,
    seo_title: seoTitle || null, seo_description: seoDesc || null,
    keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
    tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
    faq,
    body_json: editor.document,
    body_markdown: await editor.blocksToMarkdownLossy(editor.document),
    ...extra,
  });

  // ---- preview ----
  // Saves silently, then opens the blog's own renderer on this slug so what you
  // see is exactly what readers get. The tab is opened first, synchronously,
  // or the browser's popup blocker eats it.
  const preview = async () => {
    if (!title.trim()) return setMsg("Give the post a title first.");
    const tab = window.open("", "_blank");
    setBusy("preview");
    setMsg(null);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await payload()),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.suggestion) setSlugFix(j.suggestion);
        throw new Error(j.error ?? "Preview failed");
      }
      setSlugFix(null);
      if (tab) tab.location.href = j.url;
      else window.location.href = j.url;
      setMsg("Draft saved and opened in a new tab.");
      if (!initial?.id && j.slug) router.replace(`/posts/${j.slug}`);
    } catch (e) {
      tab?.close();
      setMsg(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(null);
    }
  };

  // ---- save ----
  const save = async (status: "draft" | "published") => {
    if (!title.trim()) return setMsg("Give the post a title first.");
    setBusy(status);
    setMsg(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await payload({ status })),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.suggestion) setSlugFix(j.suggestion);
        throw new Error(j.error ?? "Save failed");
      }
      setSlugFix(null);
      setMsg(status === "published" ? "Published — live on the blog." : "Draft saved.");
      router.refresh();
      if (!initial?.id && j.slug) router.replace(`/posts/${j.slug}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  };

  const seoTitleLen = (seoTitle || title).length;
  const seoDescLen = (seoDesc || excerpt).length;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] p-8">
      {/* ---------------- main column ---------------- */}
      <div className="space-y-5">
        <input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="Post title"
          className="w-full rounded-xl border border-line bg-white px-5 py-4 text-2xl font-extrabold text-ink outline-none focus:border-brand"
        />

        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-bold text-muted">/blog/</span>
          <input
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); setSlugFix(null); }}
            placeholder="url-slug"
            className="flex-1 rounded-lg border border-line bg-white px-3 py-2 font-semibold text-ink outline-none focus:border-brand"
          />
        </div>

        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="Excerpt — the summary shown on cards and in search results."
          rows={2}
          className="w-full rounded-xl border border-line bg-white px-5 py-3 text-[15px] outline-none focus:border-brand"
        />

        {/* editor */}
        <div className="rounded-xl border border-line bg-white px-5 py-4 min-h-[460px]">
          <BlockNoteView editor={editor} theme="light" />
        </div>

        {/* FAQ builder */}
        <section className="rounded-xl border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-ink">FAQ</h3>
              <p className="text-[12px] text-muted">Renders on the page and generates rich-results schema.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={genFaq} disabled={!!busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand px-3 py-1.5 text-[13px] font-extrabold text-brand hover:bg-brand hover:text-white transition-colors disabled:opacity-50">
                {busy === "faq" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Generate
              </button>
              <button onClick={() => setFaq([...faq, { q: "", a: "" }])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] font-extrabold text-ink hover:border-brand">
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {faq.length === 0 && <p className="text-[14px] text-muted">No FAQs yet.</p>}
            {faq.map((f, i) => (
              <div key={i} className="rounded-lg border border-line p-3">
                <div className="flex gap-2">
                  <input
                    value={f.q}
                    onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
                    placeholder="Question"
                    className="flex-1 rounded border border-line px-3 py-1.5 text-[14px] font-bold text-ink outline-none focus:border-brand"
                  />
                  <button onClick={() => setFaq(faq.filter((_, j) => j !== i))} className="text-muted hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
                <textarea
                  value={f.a}
                  onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
                  placeholder="Answer"
                  rows={2}
                  className="mt-2 w-full rounded border border-line px-3 py-1.5 text-[14px] outline-none focus:border-brand"
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ---------------- sidebar ---------------- */}
      <aside className="space-y-5">
        {/* publish */}
        <section className="rounded-xl border border-line bg-white p-5 sticky top-4">
          <div className="flex gap-2">
            <button onClick={() => save("draft")} disabled={!!busy}
              className="flex-1 rounded-lg border border-line py-2.5 text-sm font-extrabold text-ink hover:border-brand disabled:opacity-50">
              {busy === "draft" ? "Saving…" : "Save draft"}
            </button>
            <button onClick={() => save("published")} disabled={!!busy}
              className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-extrabold text-white hover:bg-brand-mid disabled:opacity-50">
              {busy === "published" ? "Publishing…" : "Publish"}
            </button>
          </div>
          <button onClick={preview} disabled={!!busy || !title}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-line py-2.5 text-sm font-extrabold text-ink hover:border-brand hover:text-brand transition-colors disabled:opacity-40">
            {busy === "preview" ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
            Preview on the blog
          </button>
          <p className="mt-1.5 text-[11px] text-muted">
            Opens the real article page for this draft. Saves first; never publishes.
          </p>

          {msg && (
            <p className={`mt-3 text-[13px] font-semibold ${slugFix ? "text-red-600" : "text-brand"}`}>
              {msg}
            </p>
          )}

          {slugFix && (
            <button
              onClick={() => { setSlug(slugFix); setSlugTouched(true); setSlugFix(null); setMsg(null); }}
              className="mt-2 w-full rounded-lg border border-brand px-3 py-2 text-[13px] font-extrabold text-brand hover:bg-brand hover:text-white transition-colors"
            >
              Use /blog/{slugFix} instead
            </button>
          )}

          <button onClick={draftPost} disabled={!!busy || !title}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-brand py-2.5 text-sm font-extrabold text-brand hover:bg-brand hover:text-white transition-colors disabled:opacity-40">
            {busy === "draft-ai" || busy === "draft" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Write draft with AI
          </button>
          <p className="mt-2 text-[11px] text-muted">Uses the title, category and keywords. Always review before publishing.</p>
        </section>

        {/* presentation */}
        <section className="rounded-xl border border-line bg-white p-5 space-y-4">
          <h3 className="font-extrabold text-ink">Presentation</h3>

          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
              {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </Field>

          <Field label="Post type" hint={POST_TYPES.find((t) => t.value === postType)?.hint}>
            <select value={postType} onChange={(e) => setPostType(e.target.value as PostType)} className={selectCls}>
              {POST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>

          <Field label="Card style" hint={CARD_STYLES.find((c) => c.value === cardStyle)?.hint}>
            <select value={cardStyle} onChange={(e) => setCardStyle(e.target.value as CardStyle)} className={selectCls}>
              {CARD_STYLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>

          <Field label="Font style" hint={FONT_STYLES.find((f) => f.value === fontStyle)?.hint}>
            <select value={fontStyle} onChange={(e) => setFontStyle(e.target.value as FontStyle)} className={selectCls}>
              {FONT_STYLES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </Field>

          <label className="flex items-center gap-2.5 pt-1">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="w-4 h-4 accent-[#6B5CE7]" />
            <span className="text-[14px] font-bold text-ink">Feature on homepage</span>
          </label>
        </section>

        <CoverPicker
          value={cover}
          alt={coverAlt}
          onChange={setCover}
          onAlt={setCoverAlt}
          suggestedQuery={title}
        />

        {/* SEO */}
        <section className="rounded-xl border border-line bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-ink">SEO</h3>
            <button onClick={genSeo} disabled={!!busy || !title}
              className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-brand hover:underline disabled:opacity-40">
              {busy === "seo" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Generate
            </button>
          </div>

          <div>
            <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="SEO title" className={inputCls} />
            <p className={`mt-1 text-[11px] ${seoTitleLen > 60 ? "text-red-600" : "text-muted"}`}>{seoTitleLen}/60 characters</p>
          </div>
          <div>
            <textarea value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} placeholder="Meta description" rows={3} className={inputCls} />
            <p className={`mt-1 text-[11px] ${seoDescLen > 160 ? "text-red-600" : "text-muted"}`}>{seoDescLen}/160 characters</p>
          </div>
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Target keywords, comma separated" className={inputCls} />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated" className={inputCls} />

          {/* live google preview */}
          <div className="rounded-lg border border-line bg-wash p-3">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Google preview</p>
            <p className="mt-1.5 text-[15px] text-[#1a0dab] line-clamp-1">{seoTitle || title || "Post title"}</p>
            <p className="text-[12px] text-[#006621]">askparent.com › blog › {slug || "url-slug"}</p>
            <p className="text-[12px] text-[#545454] line-clamp-2">{seoDesc || excerpt || "Meta description appears here."}</p>
          </div>
        </section>
      </aside>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-line px-3 py-2 text-[14px] outline-none focus:border-brand";
const selectCls = "w-full rounded-lg border border-line px-3 py-2 text-[14px] font-semibold text-ink outline-none focus:border-brand bg-white";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-bold text-ink mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
