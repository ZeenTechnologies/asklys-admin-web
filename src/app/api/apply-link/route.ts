import { NextResponse } from "next/server";
import { isLoggedIn } from "@/features/auth/services/session";
import { listBodies, replaceBody } from "@/features/posts/queries";
import { linkFirstOccurrence } from "@/features/posts/services/markdown-links";
import { pingSite } from "@/lib/revalidate";

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fromTitle, toTitle, anchor } = await req.json();
  if (!fromTitle || !toTitle || !anchor) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const posts = await listBodies();
  const from = posts.find((p) => p.title === fromTitle);
  const to = posts.find((p) => p.title === toTitle);

  if (!from) return NextResponse.json({ error: `Post not found: ${fromTitle}` }, { status: 404 });
  if (!to) return NextResponse.json({ error: `Post not found: ${toTitle}` }, { status: 404 });

  const { markdown, status } = linkFirstOccurrence(from.body_html ?? "", anchor, `/blog/${to.slug}`);

  if (status === "not-found") {
    return NextResponse.json({
      ok: false,
      status,
      error: `The phrase "${anchor}" doesn't appear in that post — add it to the text first, or edit the post manually.`,
    });
  }
  if (status === "already") {
    return NextResponse.json({ ok: true, status, message: "Already linked." });
  }

  await replaceBody(from.id, markdown);
  await pingSite({ slug: from.slug });

  return NextResponse.json({ ok: true, status, message: `Linked in "${from.title}".` });
}
