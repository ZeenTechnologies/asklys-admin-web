import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/** Search engines and our own domain aren't backlinks. */
const NOT_A_BACKLINK = [
  "google.", "bing.com", "duckduckgo.com", "yahoo.", "yandex.", "baidu.com",
  "ecosia.org", "brave.com", "search.", "localhost", "askparent.com",
  "t.co", "l.facebook.com", "lm.facebook.com", "out.reddit.com", "android-app",
];

const isRealReferrer = (d: string) => !!d && !NOT_A_BACKLINK.some((x) => d.includes(x));

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const db = supabaseAdmin();

  /* ------------------------------------------------------------------ sync
   * Turn real referrer traffic into backlink rows. A domain can only show up
   * here if somebody actually clicked a link to us from it — which makes this
   * the only backlink data on the page that is verified rather than claimed.
   */
  if (body.action === "sync") {
    const { data, error } = await db.from("referring_domains").select("*").limit(500);
    if (error) {
      return NextResponse.json(
        { error: `${error.message} — have you run supabase/0002_social_and_backlinks.sql?` },
        { status: 400 },
      );
    }

    const rows = (data ?? []) as {
      domain: string; sessions: number; landing_pages: number;
      first_seen: string; last_seen: string;
    }[];

    const found = rows.filter((r) => isRealReferrer(r.domain));
    let added = 0;

    for (const r of found) {
      const { data: existing } = await db
        .from("backlinks")
        .select("id,kind")
        .eq("domain", r.domain)
        .limit(1);

      if (existing?.length) {
        // keep the referral count fresh, but never overwrite a manual entry's status
        await db
          .from("backlinks")
          .update({ referrals: r.sessions, last_seen: r.last_seen })
          .eq("id", existing[0].id);
      } else {
        await db.from("backlinks").insert({
          domain: r.domain,
          kind: "detected",
          status: "live",
          referrals: r.sessions,
          first_seen: r.first_seen,
          last_seen: r.last_seen,
          notes: `Auto-detected from ${r.sessions} referred session${r.sessions === 1 ? "" : "s"}.`,
        });
        added++;
      }
    }

    return NextResponse.json({ ok: true, scanned: rows.length, linked: found.length, added });
  }

  /* ---------------------------------------------------------------- delete */
  if (body.action === "delete") {
    await db.from("backlinks").delete().eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  /* ------------------------------------------------------------ create/edit */
  if (!body.domain) {
    return NextResponse.json({ error: "A domain is required." }, { status: 400 });
  }

  const row = {
    domain: String(body.domain).replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase(),
    url: body.url || null,
    target_path: body.target_path || null,
    anchor: body.anchor || null,
    kind: body.kind ?? "manual",
    status: body.status ?? "idea",
    authority: body.authority === "" || body.authority == null ? null : Number(body.authority),
    dofollow: body.dofollow ?? true,
    notes: body.notes ?? "",
  };

  const { error } = body.id
    ? await db.from("backlinks").update(row).eq("id", body.id)
    : await db.from("backlinks").insert(row);

  if (error) {
    const msg =
      error.code === "23505"
        ? "That domain + target page is already tracked."
        : `${error.message} — have you run supabase/0002_social_and_backlinks.sql?`;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
