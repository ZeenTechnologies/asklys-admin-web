import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { env } from "@/lib/env";

/**
 * Insert an internal link into a post's body.
 *
 * The article body is stored as markdown, so "linking" means turning the first
 * plain-text occurrence of the anchor phrase into [anchor](/blog/target-slug).
 *
 * Careful about three things:
 *  - never touch a phrase that is already inside a link
 *  - never link inside a heading (looks wrong, and Google ignores it)
 *  - only the FIRST occurrence — repeating the same link is spammy
 */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function insertLink(markdown: string, anchor: string, href: string) {
  // already linked to this target somewhere? then we're done
  if (markdown.includes(`](${href})`)) {
    return { markdown, status: "already" as const };
  }

  const lines = markdown.split("\n");
  const re = new RegExp(escapeRe(anchor), "i");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("#")) continue;            // skip headings
    if (line.trim().startsWith("|")) continue;            // skip tables
    const m = line.match(re);
    if (!m || m.index === undefined) continue;

    // is this occurrence already inside a markdown link?
    const before = line.slice(0, m.index);
    const openBrackets = (before.match(/\[/g) ?? []).length;
    const closeBrackets = (before.match(/\]/g) ?? []).length;
    if (openBrackets > closeBrackets) continue;

    const found = m[0];                                    // keep the original casing
    lines[i] = line.slice(0, m.index) + `[${found}](${href})` + line.slice(m.index + found.length);
    return { markdown: lines.join("\n"), status: "linked" as const };
  }

  return { markdown, status: "not-found" as const };
}

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fromTitle, toTitle, anchor } = await req.json();
  if (!fromTitle || !toTitle || !anchor) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: posts } = await db.from("posts").select("id,slug,title,body_html");
  const from = (posts ?? []).find((p) => p.title === fromTitle);
  const to = (posts ?? []).find((p) => p.title === toTitle);

  if (!from) return NextResponse.json({ error: `Post not found: ${fromTitle}` }, { status: 404 });
  if (!to) return NextResponse.json({ error: `Post not found: ${toTitle}` }, { status: 404 });

  const { markdown, status } = insertLink(from.body_html ?? "", anchor, `/blog/${to.slug}`);

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

  // body_json is left as-is; the composer re-parses the markdown on open,
  // so the markdown stays the single source of truth.
  await db.from("posts").update({ body_html: markdown, body_json: null }).eq("id", from.id);

  if (env.SITE_URL) {
    try {
      await fetch(`${env.SITE_URL}/api/revalidate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": env.REVALIDATE_SECRET,
        },
        body: JSON.stringify({ slug: from.slug }),
      });
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ ok: true, status, message: `Linked in "${from.title}".` });
}
