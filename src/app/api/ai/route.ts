import { NextResponse } from "next/server";
import { isLoggedIn } from "@/features/auth/services/session";
import { ask, askJson } from "@/lib/ai";

const VOICE = `You write for Ask Parent, an independent publication about screen time,
phones and family digital habits. Voice: calm, specific, practical. Never alarmist,
never preachy. Address a parent who is tired and wants an answer. Use British-neutral
plain English. Cite real organisations (Common Sense Media, AAP, Ofcom) only when the
claim is genuinely well established, and never invent statistics.`;

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, title, category, postType, keywords, excerpt } = await req.json();

  try {
    if (action === "draft") {
      const md = await ask(
        `Write a ${postType} for the "${category}" section titled "${title}".
Target keywords: ${keywords || "(none given)"}.

Rules:
- 900-1400 words of genuinely useful advice a parent could act on today.
- Markdown. Use ## for section headings (5-7 of them). No H1 — the title is separate.
- Open with the reader's actual situation, not a definition.
- Include one markdown table if it genuinely helps.
- Be honest about trade-offs and where advice is uncertain.
- Do not mention any product by name.`,
        VOICE,
      );
      const ex = await ask(
        `Write ONE sentence (max 155 characters) summarising an article titled "${title}". No quotes.`,
        VOICE,
      );
      return NextResponse.json({ markdown: md, excerpt: ex.trim().replace(/^["']|["']$/g, "") });
    }

    if (action === "seo") {
      const j = await askJson<{ seoTitle: string; seoDescription: string; keywords: string[] }>(
        `Article title: "${title}"
Section: ${category}
Summary: ${excerpt || "(none)"}

Return JSON: {"seoTitle": "<=60 chars, front-load the query a parent would type",
"seoDescription":"<=155 chars, benefit-led, includes the main keyword",
"keywords":["6-8 realistic search queries, long-tail, lowercase"]}`,
        VOICE,
      );
      return NextResponse.json(j);
    }

    if (action === "faq") {
      const j = await askJson<{ faq: { q: string; a: string }[] }>(
        `Article: "${title}" (${category}). Summary: ${excerpt || "(none)"}

Return JSON: {"faq":[{"q":"...","a":"..."}]} with 4-5 entries.
Questions must be ones parents genuinely type into Google about this topic.
Answers: 2-3 sentences, specific and honest, no marketing.`,
        VOICE,
      );
      return NextResponse.json(j);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI request failed" },
      { status: 500 },
    );
  }
}
