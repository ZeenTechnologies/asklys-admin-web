"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";

export type SocialRow = {
  id: string;
  platform: string;
  permalink: string;
  image: string;
  caption: string;
  alt: string;
  likes: number;
  position: number;
  active: boolean;
  video: string;
  poster: string;
  featured: boolean;
};

const PLATFORMS = ["instagram", "tiktok", "pinterest", "x", "youtube"];

const blank = (): Partial<SocialRow> => ({
  platform: "instagram",
  permalink: "",
  image: "",
  caption: "",
  alt: "",
  likes: 0,
  position: 0,
  active: true,
  video: "",
  poster: "",
  featured: false,
});

export function SocialManager({ rows }: { rows: SocialRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Partial<SocialRow> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const call = async (payload: Record<string, unknown>, tag: string) => {
    setBusy(tag);
    setMsg(null);
    try {
      const res = await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      return j;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const lookup = async () => {
    if (!draft?.permalink) return setMsg("Paste the post URL first.");
    const j = await call({ action: "lookup", permalink: draft.permalink }, "lookup");
    if (!j) return;
    if (!j.image && !j.caption) {
      setMsg("Couldn't read that post automatically — paste the image URL and caption by hand.");
      return;
    }
    setDraft({ ...draft, image: j.image || draft.image, caption: j.caption || draft.caption });
    setMsg("Pulled the thumbnail and caption from the post.");
  };

  const save = async () => {
    if (!draft?.permalink) return setMsg("A post URL is required.");
    const j = await call(draft as Record<string, unknown>, "save");
    if (!j) return;
    setDraft(null);
    setMsg("Saved — the blog grid updates within a few seconds.");
    router.refresh();
  };

  const remove = async (id: string) => {
    const j = await call({ action: "delete", id }, `del-${id}`);
    if (j) router.refresh();
  };

  const toggle = async (r: SocialRow) => {
    const j = await call({ ...r, active: !r.active }, `tog-${r.id}`);
    if (j) router.refresh();
  };

  return (
    <div className="p-8 space-y-6">
      {msg && (
        <div className="rounded-lg border border-brand/30 bg-brand/5 px-4 py-3 text-[14px] font-semibold text-brand">
          {msg}
        </div>
      )}

      {!draft && (
        <button
          onClick={() => setDraft(blank())}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-mid"
        >
          <Plus size={16} />
          Add a post
        </button>
      )}

      {/* ---- editor ---- */}
      {draft && (
        <section className="rounded-xl border border-line bg-white p-6 space-y-4">
          <h2 className="font-extrabold text-ink text-lg">
            {draft.id ? "Edit post" : "Add a social post"}
          </h2>

          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <Field label="Platform">
              <select
                value={draft.platform}
                onChange={(e) => setDraft({ ...draft, platform: e.target.value })}
                className={selectCls}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>

            <Field label="Post URL" hint="Open the post on Instagram, copy the link from the address bar.">
              <div className="flex gap-2">
                <input
                  value={draft.permalink}
                  onChange={(e) => setDraft({ ...draft, permalink: e.target.value })}
                  placeholder="https://www.instagram.com/p/…"
                  className={inputCls}
                />
                <button
                  onClick={lookup}
                  disabled={!!busy}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-brand px-3.5 py-2 text-[13px] font-extrabold text-brand hover:bg-brand hover:text-white disabled:opacity-50"
                >
                  {busy === "lookup" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Fetch
                </button>
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <Field label="Image URL" hint="The square thumbnail shown in the grid.">
              <input
                value={draft.image}
                onChange={(e) => setDraft({ ...draft, image: e.target.value })}
                placeholder="https://…"
                className={inputCls}
              />
            </Field>
            {draft.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.image} alt="" className="h-[104px] w-[104px] rounded-lg border border-line object-cover" />
            )}
          </div>

          {/* the reel itself */}
          <div className="rounded-lg border border-line bg-wash p-4 space-y-3">
            <p className="text-[13px] font-extrabold text-ink">Reel video (optional)</p>
            <p className="-mt-1.5 text-[11px] leading-relaxed text-muted">
              Instagram blocks hotlinking their video, so point this at your own render —
              drop the mp4 in <code className="font-mono">pv-blog/public/social/</code> and use
              <code className="font-mono"> /social/name.mp4</code>, or upload it and paste the URL.
              Portrait 9:16 works best.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Video URL">
                <input
                  value={draft.video ?? ""}
                  onChange={(e) => setDraft({ ...draft, video: e.target.value })}
                  placeholder="/social/pv-reel-v2.mp4"
                  className={inputCls}
                />
              </Field>
              <Field label="Poster image" hint="First frame — shown before it plays.">
                <input
                  value={draft.poster ?? ""}
                  onChange={(e) => setDraft({ ...draft, poster: e.target.value })}
                  placeholder="/social/pv-reel-v2.jpg"
                  className={inputCls}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={Boolean(draft.featured)}
                onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
                className="w-4 h-4 accent-[#6B5CE7]"
              />
              <span className="text-[13px] font-bold text-ink">
                Play this one big at the top of the section
              </span>
            </label>
          </div>

          <Field label="Caption">
            <textarea
              value={draft.caption}
              onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
              rows={2}
              placeholder="Shown when someone hovers the tile."
              className={inputCls}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Alt text" hint="Accessibility + image SEO.">
              <input value={draft.alt} onChange={(e) => setDraft({ ...draft, alt: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Likes" hint="Optional badge on the tile.">
              <input type="number" value={draft.likes} onChange={(e) => setDraft({ ...draft, likes: Number(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="Position" hint="Lower shows first.">
              <input type="number" value={draft.position} onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) })} className={inputCls} />
            </Field>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={!!busy}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-mid disabled:opacity-50"
            >
              {busy === "save" ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setDraft(null); setMsg(null); }}
              className="rounded-lg border border-line px-5 py-2.5 text-sm font-extrabold text-ink hover:border-brand"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* ---- current grid ---- */}
      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="font-extrabold text-ink">On the blog now</h2>
        <p className="mt-1 text-[14px] text-muted">
          The starred reel plays big at the top; the next six active posts, lowest position
          first, fill the grid below it.
        </p>

        {rows.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-line px-4 py-8 text-center text-[15px] text-muted">
            No social posts yet.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {rows.map((r) => (
              <div key={r.id} className={`rounded-xl border border-line overflow-hidden ${r.active ? "" : "opacity-45"}`}>
                <div className="relative aspect-square bg-wash">
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image} alt={r.alt} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-[12px] text-muted">no image</div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white">
                    {r.platform}
                  </span>
                  {r.video && (
                    <span className="absolute right-1.5 top-1.5 rounded bg-brand px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white">
                      {r.featured ? "★ reel" : "reel"}
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-[12px] leading-snug text-body line-clamp-2">{r.caption || "—"}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button onClick={() => setDraft(r)} className="text-[12px] font-extrabold text-brand hover:underline">
                      Edit
                    </button>
                    <button onClick={() => toggle(r)} title={r.active ? "Hide" : "Show"} className="ml-auto text-muted hover:text-ink">
                      {r.active ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button onClick={() => remove(r.id)} title="Delete" className="text-muted hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
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
