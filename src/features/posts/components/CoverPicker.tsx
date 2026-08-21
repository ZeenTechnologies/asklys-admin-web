"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Search, Upload, X } from "lucide-react";

type Photo = { id: number; url: string; thumb: string; alt: string; photographer: string };

/**
 * Cover image chooser: upload your own, or search free stock.
 *
 * Before this, setting a cover meant leaving the composer, uploading in Media,
 * copying a URL and coming back — enough friction that posts got published with
 * no image at all, which costs clicks everywhere the card appears.
 */
export function CoverPicker({
  value,
  alt,
  onChange,
  onAlt,
  suggestedQuery,
}: {
  value: string;
  alt: string;
  onChange: (url: string) => void;
  onAlt: (alt: string) => void;
  suggestedQuery?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "search" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [open, setOpen] = useState(false);

  const upload = async (file: File) => {
    setBusy("upload");
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("alt", alt || "");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Upload failed");
      onChange(j.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const search = async () => {
    const q = query.trim() || suggestedQuery?.trim();
    if (!q) return setErr("Type what the photo should show.");
    setBusy("search");
    setErr(null);
    try {
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Search failed");
      setPhotos(j.photos ?? []);
      if ((j.photos ?? []).length === 0) setErr("Nothing found — try different words.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-xl border border-line bg-white p-5 space-y-3">
      <h3 className="font-extrabold text-ink">Cover image</h3>

      {value ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="w-full rounded-lg border border-line" />
          <button
            onClick={() => onChange("")}
            aria-label="Remove cover image"
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="grid h-28 place-items-center rounded-lg border border-dashed border-line text-[13px] text-muted">
          No cover image yet
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-extrabold text-ink hover:border-brand hover:text-brand disabled:opacity-50"
        >
          {busy === "upload" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Upload
        </button>
        <button
          onClick={() => { setOpen((v) => !v); setErr(null); }}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-extrabold text-ink hover:border-brand hover:text-brand"
        >
          <ImagePlus size={14} />
          Find a photo
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />

      {open && (
        <div className="rounded-lg border border-line bg-wash p-3 space-y-3">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder={suggestedQuery ? `e.g. ${suggestedQuery}` : "teenager using phone"}
              className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
            />
            <button
              onClick={search}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-extrabold text-white hover:bg-brand-mid disabled:opacity-50"
            >
              {busy === "search" ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Search
            </button>
          </div>

          {photos.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onChange(p.url);
                      if (!alt) onAlt(p.alt);
                      setOpen(false);
                    }}
                    title={`Photo by ${p.photographer}`}
                    className="relative aspect-[4/3] overflow-hidden rounded border border-line hover:ring-2 hover:ring-brand"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumb} alt={p.alt} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted">
                Free to use commercially, no credit required. Click one to set it as the cover.
              </p>
            </>
          )}
        </div>
      )}

      {err && <p className="text-[12px] font-semibold text-red-600">{err}</p>}

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste an image URL"
        className="w-full rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
      />
      <input
        value={alt}
        onChange={(e) => onAlt(e.target.value)}
        placeholder="Alt text — describe the photo (SEO + accessibility)"
        className="w-full rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
      />
    </section>
  );
}
