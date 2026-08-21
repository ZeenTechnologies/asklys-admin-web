import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isLoggedIn } from "@/features/auth/services/session";
import { env } from "@/lib/env";

/**
 * Stock photo search for the composer's cover-image picker.
 *
 * Pexels photos are free for commercial use with no attribution required, which
 * is what makes them safe to publish. The key is shared with the PV project —
 * read from this app's env first, else from Desktop\Total\PV\.env.
 */
const KEY = (() => {
  if (env.PEXELS_API_KEY) return env.PEXELS_API_KEY;
  try {
    const p = path.join(process.cwd(), "..", "PV", ".env");
    return readFileSync(p, "utf8").match(/^PEXELS_API_KEY=(.+)$/m)?.[1].trim() ?? "";
  } catch {
    return "";
  }
})();

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!KEY) {
    return NextResponse.json(
      { error: "No PEXELS_API_KEY set — add one to .env.local to search stock photos." },
      { status: 500 },
    );
  }

  const { query } = await req.json();
  if (!query?.trim()) {
    return NextResponse.json({ error: "Type what you're looking for." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=12`,
      { headers: { Authorization: KEY, "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(12000) },
    );
    if (!res.ok) {
      return NextResponse.json({ error: `Photo search failed (${res.status}).` }, { status: 502 });
    }
    const j = await res.json();

    return NextResponse.json({
      photos: (j.photos ?? []).map((p: Record<string, unknown>) => {
        const src = p.src as Record<string, string>;
        return {
          id: p.id,
          // 1200x675 crop — the size the hero and cards actually render at
          url: `${src.original}?auto=compress&cs=tinysrgb&w=1200&h=675&fit=crop`,
          thumb: src.medium,
          alt: (p.alt as string) || query,
          photographer: p.photographer as string,
        };
      }),
    });
  } catch {
    return NextResponse.json({ error: "Photo search timed out." }, { status: 504 });
  }
}
