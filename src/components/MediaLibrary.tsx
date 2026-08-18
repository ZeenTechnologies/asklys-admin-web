"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Trash2, Upload } from "lucide-react";

type MediaItem = { id: string; url: string; path: string; alt: string; size_bytes: number; created_at: string };

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export function MediaLibrary({ items }: { items: MediaItem[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const upload = async (files: FileList | File[]) => {
    setBusy(true);
    setErr(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("alt", file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Upload failed");
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (path: string) => {
    if (!confirm("Delete this image? Any post using it will lose the picture.")) return;
    setBusy(true);
    try {
      await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className="p-8 space-y-6">
      {/* drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          drag ? "border-brand bg-brand/5" : "border-line bg-white hover:border-brand"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => e.target.files?.length && upload(e.target.files)}
        />
        {busy ? (
          <Loader2 size={26} className="mx-auto animate-spin text-brand" />
        ) : (
          <Upload size={26} className="mx-auto text-brand" />
        )}
        <p className="mt-3 font-extrabold text-ink">
          {busy ? "Uploading…" : "Drop images here, or click to choose"}
        </p>
        <p className="mt-1 text-[13px] text-muted">PNG, JPG, WebP or GIF · up to 10MB each</p>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
          {err}
        </div>
      )}

      {/* grid */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-line bg-white p-12 text-center">
          <p className="font-extrabold text-ink">No images yet</p>
          <p className="mt-1 text-[15px] text-muted">Upload one and it&apos;s ready to use in any post.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((m) => (
            <div key={m.id} className="group rounded-xl border border-line bg-white overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.alt} className="aspect-[4/3] w-full object-cover" />
              <div className="p-3">
                <p className="truncate text-[13px] font-bold text-ink">{m.alt || "Untitled"}</p>
                <p className="text-[11px] text-muted">{kb(m.size_bytes ?? 0)}</p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={() => copy(m.url)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-line py-1.5 text-[12px] font-extrabold text-ink hover:border-brand"
                  >
                    {copied === m.url ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    {copied === m.url ? "Copied" : "Copy URL"}
                  </button>
                  <button
                    onClick={() => remove(m.path)}
                    className="rounded-lg border border-line px-2.5 text-muted hover:border-red-300 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
