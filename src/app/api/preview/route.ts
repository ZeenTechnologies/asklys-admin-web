import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Save the current editor state as a draft and hand back a signed preview URL.
 *
 * The preview secret never reaches the browser — the composer just opens the
 * URL this route returns.
 */
export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, body_markdown, ...fields } = body;

  if (!fields.slug || !fields.title) {
    return NextResponse.json({ error: "Give the post a title first." }, { status: 400 });
  }

  const words = String(body_markdown ?? "").trim().split(/\s+/).length;
  const row: Record<string, unknown> = {
    ...fields,
    body_html: body_markdown ?? "",
    read_mins: Math.max(1, Math.round(words / 220)),
  };
  // Previewing must never publish, and must never un-publish something live.
  delete row.status;
  delete row.published_at;

  const db = supabaseAdmin();
  const q = id
    ? db.from("posts").update(row).eq("id", id).select("slug").single()
    : db.from("posts").insert({ ...row, status: "draft" }).select("slug").single();

  const { data, error } = await q;
  if (error) {
    if (error.code === "23505") {
      // mirror /api/posts: name the clash and offer a free slug
      const stem = String(fields.slug).replace(/-\d+$/, "");
      const { data: similar } = await db.from("posts").select("slug").like("slug", `${stem}%`);
      const taken = new Set((similar ?? []).map((r) => (r as { slug: string }).slug));
      let suggestion = `${stem}-2`;
      for (let n = 2; n < 50; n++) {
        if (!taken.has(`${stem}-${n}`)) { suggestion = `${stem}-${n}`; break; }
      }
      return NextResponse.json(
        {
          error: `The URL /blog/${fields.slug} is already used by another post.`,
          conflictSlug: fields.slug,
          suggestion,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const blog = process.env.BLOG_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!blog || !secret) {
    return NextResponse.json(
      { error: "Set BLOG_URL and REVALIDATE_SECRET in .env.local to enable preview." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    slug: data.slug,
    url: `${blog}/preview/${data.slug}?token=${encodeURIComponent(secret)}`,
  });
}
