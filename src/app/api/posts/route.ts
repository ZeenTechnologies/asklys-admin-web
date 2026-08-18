import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { embed } from "@/lib/ai";

/**
 * Find the first free variant of a taken slug: `my-post` → `my-post-2`, `-3`…
 * Capped so a pathological case can't loop forever.
 */
async function freeSlug(
  db: ReturnType<typeof supabaseAdmin>,
  base: string,
): Promise<string> {
  const stem = base.replace(/-\d+$/, ""); // don't produce my-post-2-2
  const { data } = await db.from("posts").select("slug").like("slug", `${stem}%`);
  const taken = new Set((data ?? []).map((r) => (r as { slug: string }).slug));
  for (let n = 2; n < 50; n++) {
    const candidate = `${stem}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem}-${Date.now().toString().slice(-5)}`;
}

/** Create or update a post, then ping the blog to refresh. */
export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, body_markdown, ...fields } = body;

  if (!fields.slug || !fields.title) {
    return NextResponse.json({ error: "Title and slug are required" }, { status: 400 });
  }

  const words = String(body_markdown ?? "").trim().split(/\s+/).length;
  const row: Record<string, unknown> = {
    ...fields,
    body_html: body_markdown ?? "",
    read_mins: Math.max(1, Math.round(words / 220)),
    published_at:
      fields.status === "published" ? (body.published_at ?? new Date().toISOString()) : null,
  };

  // embedding powers "related posts" on the blog — best effort, never blocks a save
  try {
    const v = await embed(`${fields.title}\n${fields.excerpt ?? ""}\n${String(body_markdown ?? "").slice(0, 4000)}`);
    if (v.length) row.embedding = v;
  } catch (e) {
    console.warn("[posts] embedding skipped:", e);
  }

  const db = supabaseAdmin();
  const q = id
    ? db.from("posts").update(row).eq("id", id).select("slug").single()
    : db.from("posts").insert(row).select("slug").single();

  const { data, error } = await q;
  if (error) {
    // 23505 = unique violation on `slug`. Say which slug clashed and hand back
    // a free one, so the fix is a single click rather than a guessing game.
    if (error.code === "23505") {
      const suggestion = await freeSlug(db, String(fields.slug));
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

  // tell the blog to rebuild this page
  if (fields.status === "published" && process.env.BLOG_URL) {
    try {
      await fetch(`${process.env.BLOG_URL}/api/revalidate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": process.env.REVALIDATE_SECRET ?? "",
        },
        body: JSON.stringify({ slug: data.slug }),
      });
    } catch (e) {
      console.warn("[posts] revalidate ping failed:", e);
    }
  }

  return NextResponse.json({ ok: true, slug: data.slug });
}
