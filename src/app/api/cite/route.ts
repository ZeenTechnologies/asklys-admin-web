import { NextResponse } from "next/server";
import { isLoggedIn } from "@/features/auth/services/session";
import { findBodyBySlug, replaceBody } from "@/features/posts/queries";
import { appendToSources, linkFirstOccurrence } from "@/features/posts/services/markdown-links";
import { recordCitation } from "@/features/assistant/queries";
import { pingSite } from "@/lib/revalidate";

// Two placements: `inline` hyperlinks a phrase already in the body (best for SEO —
// the link sits in context); `sources` appends to a list at the foot of the article.

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, url, title, publisher, year, doi, anchor, mode = "sources" } = await req.json();
  if (!slug || !url || !title) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const post = await findBodyBySlug(slug);

  if (!post) return NextResponse.json({ error: `Post not found: ${slug}` }, { status: 404 });

  const label = publisher ? `${title} — ${publisher}${year ? `, ${year}` : ""}` : title;
  const result =
    mode === "inline" && anchor
      ? linkFirstOccurrence(post.body_html ?? "", anchor, url)
      : appendToSources(post.body_html ?? "", label, url);

  if (result.status === "not-found") {
    return NextResponse.json({
      ok: false,
      status: result.status,
      error: `"${anchor}" doesn't appear in the article — add it to a "Sources" list instead.`,
    });
  }

  if (result.status === "linked") await replaceBody(post.id, result.markdown);

  await recordCitation({ post_slug: slug, title, url, publisher, year, doi });
  await pingSite({ slug });

  return NextResponse.json({
    ok: true,
    status: result.status,
    message: result.status === "already" ? "Already cited." : "Source added to the article.",
  });
}
