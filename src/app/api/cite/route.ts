import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { env } from "@/lib/env";

/**
 * Add an external source to a post.
 *
 * Two placements, because they do different jobs:
 *   inline  — hyperlinks a phrase already in the body. Best for SEO: the link
 *             sits in context and the anchor text describes the destination.
 *   sources — appends to a "Sources" list at the foot of the article. Use when
 *             the phrase isn't in the text, so nothing gets shoehorned in.
 */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function linkInline(markdown: string, anchor: string, href: string) {
  if (markdown.includes(`](${href})`)) return { markdown, status: "already" as const };

  const lines = markdown.split("\n");
  const re = new RegExp(escapeRe(anchor), "i");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("#")) continue;   // never inside a heading
    if (line.trim().startsWith("|")) continue;   // never inside a table
    const m = line.match(re);
    if (!m || m.index === undefined) continue;

    const before = line.slice(0, m.index);
    if ((before.match(/\[/g) ?? []).length > (before.match(/\]/g) ?? []).length) continue;

    const found = m[0];
    lines[i] = line.slice(0, m.index) + `[${found}](${href})` + line.slice(m.index + found.length);
    return { markdown: lines.join("\n"), status: "linked" as const };
  }
  return { markdown, status: "not-found" as const };
}

function appendSource(markdown: string, label: string, href: string) {
  if (markdown.includes(href)) return { markdown, status: "already" as const };

  const entry = `- [${label}](${href})`;
  const idx = markdown.search(/^##\s+Sources\s*$/im);

  if (idx === -1) {
    return {
      markdown: `${markdown.trimEnd()}\n\n## Sources\n\n${entry}\n`,
      status: "linked" as const,
    };
  }

  // append to the existing list, after the last bullet under the heading
  const lines = markdown.split("\n");
  const headingLine = lines.findIndex((l) => /^##\s+Sources\s*$/i.test(l));
  let end = headingLine + 1;
  while (end < lines.length && (lines[end].trim() === "" || lines[end].trim().startsWith("-"))) end++;
  lines.splice(end, 0, entry);
  return { markdown: lines.join("\n"), status: "linked" as const };
}

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, url, title, publisher, year, doi, anchor, mode = "sources" } = await req.json();
  if (!slug || !url || !title) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: post } = await db
    .from("posts")
    .select("id,slug,body_html")
    .eq("slug", slug)
    .single();

  if (!post) return NextResponse.json({ error: `Post not found: ${slug}` }, { status: 404 });

  const label = publisher ? `${title} — ${publisher}${year ? `, ${year}` : ""}` : title;
  const result =
    mode === "inline" && anchor
      ? linkInline(post.body_html ?? "", anchor, url)
      : appendSource(post.body_html ?? "", label, url);

  if (result.status === "not-found") {
    return NextResponse.json({
      ok: false,
      status: result.status,
      error: `"${anchor}" doesn't appear in the article — add it to a "Sources" list instead.`,
    });
  }

  if (result.status === "linked") {
    // body_json is cleared so the composer re-parses the markdown on open
    await db.from("posts").update({ body_html: result.markdown, body_json: null }).eq("id", post.id);
  }

  await db.from("citations").insert({
    post_slug: slug,
    title,
    url,
    publisher: publisher ?? "",
    year: year ?? null,
    doi: doi ?? null,
    applied: true,
  });

  if (env.SITE_URL) {
    try {
      await fetch(`${env.SITE_URL}/api/revalidate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": env.REVALIDATE_SECRET,
        },
        body: JSON.stringify({ slug }),
      });
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    message: result.status === "already" ? "Already cited." : "Source added to the article.",
  });
}
