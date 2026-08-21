import { NextResponse } from "next/server";
import { isLoggedIn } from "@/features/auth/services/session";
import { embed } from "@/lib/ai";
import { pingSite } from "@/lib/revalidate";
import { freeSlug, insertPost, updatePost, type PostInput } from "@/features/posts/queries";

// Create or update a post, then ping the site to refresh.
export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, body_markdown, ...fields } = body;

  if (!fields.slug || !fields.title) {
    return NextResponse.json({ error: "Title and slug are required" }, { status: 400 });
  }

  const markdown = String(body_markdown ?? "");
  const words = markdown.trim().split(/\s+/).length;

  const input: PostInput = {
    ...fields,
    body_html: markdown,
    read_mins: Math.max(1, Math.round(words / 220)),
    published_at:
      fields.status === "published" ? (body.published_at ?? new Date().toISOString()) : null,
  };

  // Embedding powers related posts on the site — best effort, never blocks a save.
  try {
    const v = await embed(`${fields.title}\n${fields.excerpt ?? ""}\n${markdown.slice(0, 4000)}`);
    if (v.length) input.embedding = v;
  } catch (e) {
    console.warn("[posts] embedding skipped:", e);
  }

  let saved: { slug: string } | null;
  try {
    saved = id ? await updatePost(String(id), input) : await insertPost(input);
  } catch (e) {
    // 23505 = duplicate slug. Hand back a free one so the fix is one click.
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json(
        {
          error: `The URL /blog/${fields.slug} is already used by another post.`,
          conflictSlug: fields.slug,
          suggestion: await freeSlug(String(fields.slug)),
        },
        { status: 409 },
      );
    }
    console.error("[posts] save failed:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  if (!saved) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  if (fields.status === "published") await pingSite({ slug: saved.slug });

  return NextResponse.json({ ok: true, slug: saved.slug });
}
