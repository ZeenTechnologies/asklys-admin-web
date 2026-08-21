import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { env } from "@/lib/env";

/** Ask the blog to rebuild anything showing the social grid. */
async function ping() {
  if (!env.SITE_URL) return;
  try {
    await fetch(`${env.SITE_URL}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": env.REVALIDATE_SECRET,
      },
      body: JSON.stringify({ tag: "social" }),
    });
  } catch { /* non-fatal */ }
}

/**
 * Instagram's oEmbed endpoint needs a Facebook app token, so instead of
 * scraping we read the post's public Open Graph tags to prefill the thumbnail
 * and caption. Works for a normal public post; falls back to empty silently.
 */
async function scrapeOg(permalink: string) {
  try {
    const res = await fetch(permalink, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AskParentBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return {};
    const html = await res.text();
    const meta = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1]
      ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"))?.[1];
    const decode = (s?: string) =>
      s?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    return { image: decode(meta("og:image")) ?? "", caption: decode(meta("og:description")) ?? "" };
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const db = supabaseAdmin();

  // ---- delete ----
  if (body.action === "delete") {
    await db.from("social_posts").delete().eq("id", body.id);
    await ping();
    return NextResponse.json({ ok: true });
  }

  // ---- fetch metadata for a pasted URL, without saving ----
  if (body.action === "lookup") {
    if (!body.permalink) return NextResponse.json({ error: "Paste a post URL first." }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await scrapeOg(body.permalink)) });
  }

  // ---- create / update ----
  if (!body.permalink) {
    return NextResponse.json({ error: "A post URL is required." }, { status: 400 });
  }

  const row = {
    platform: body.platform ?? "instagram",
    permalink: body.permalink,
    image: body.image ?? "",
    caption: body.caption ?? "",
    alt: body.alt ?? "",
    post_slug: body.post_slug || null,
    likes: Number(body.likes) || 0,
    position: Number(body.position) || 0,
    active: body.active ?? true,
    video: body.video ?? "",
    poster: body.poster ?? "",
    featured: Boolean(body.featured),
  };

  // Only one reel plays at the top, so featuring this one un-features the rest.
  if (row.featured) {
    await db.from("social_posts").update({ featured: false }).neq("id", body.id ?? "00000000-0000-0000-0000-000000000000");
  }

  const { error } = body.id
    ? await db.from("social_posts").update(row).eq("id", body.id)
    : await db.from("social_posts").insert(row);

  if (error) {
    const msg = /column .* does not exist/i.test(error.message)
      ? `${error.message} — re-run supabase/0002_social_and_backlinks.sql, it now adds the video columns.`
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await ping();
  return NextResponse.json({ ok: true });
}
