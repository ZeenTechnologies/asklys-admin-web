import { NextResponse } from "next/server";
import { isLoggedIn } from "@/features/auth/services/session";
import { pingSite } from "@/lib/revalidate";
import { clearFeatured, deleteSocial, insertSocial, updateSocial } from "@/features/social/queries";
import { scrapeOpenGraph } from "@/features/social/services/og-scrape";

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.action === "delete") {
    await deleteSocial(body.id);
    await pingSite({ tag: "social" });
    return NextResponse.json({ ok: true });
  }

  // Fetch metadata for a pasted URL, without saving.
  if (body.action === "lookup") {
    if (!body.permalink) return NextResponse.json({ error: "Paste a post URL first." }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await scrapeOpenGraph(body.permalink)) });
  }

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

  if (row.featured) await clearFeatured(body.id);

  try {
    if (body.id) await updateSocial(body.id, row);
    else await insertSocial(row);
  } catch (e) {
    const message = (e as Error).message;
    const msg = /column .* does not exist/i.test(message)
      ? `${message} — re-run db/0002_social_and_backlinks.sql, it adds the video columns.`
      : message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await pingSite({ tag: "social" });
  return NextResponse.json({ ok: true });
}
