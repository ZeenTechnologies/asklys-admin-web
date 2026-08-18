"use client";

import dynamic from "next/dynamic";
import type { Post } from "@/lib/types";

/**
 * BlockNote touches `window` at construction, so the editor can never be
 * server-rendered. This wrapper is the client boundary that loads it lazily.
 */
const Composer = dynamic(() => import("./Composer").then((m) => m.Composer), {
  ssr: false,
  loading: () => (
    <div className="p-8">
      <div className="rounded-xl border border-line bg-white p-12 text-center">
        <p className="font-bold text-muted">Loading editor…</p>
      </div>
    </div>
  ),
});

export function ComposerLoader({ initial }: { initial?: Partial<Post> }) {
  return <Composer initial={initial} />;
}
