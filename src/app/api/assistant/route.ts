import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { askJson } from "@/lib/ai";
import { matchAuthorities, searchOpenAlex, type Source } from "@/lib/research";

/**
 * Getting this wrong is expensive: an earlier version said "its commercial goal
 * is app installs", and the model concluded Ask Parent WAS an app and started
 * proposing "How to install Ask Parent on your child's iPhone". Be explicit
 * about what is a publication and what is a product.
 */
const CONTEXT = `Ask Parent is an independent online MAGAZINE — a publisher of articles. It is
NOT an app and has no software to install. It writes about screen time, phone habits, online
safety and family routines for parents of children aged roughly 8-18 who want practical
answers, not panic.

It earns revenue by reviewing parental-control apps made by OTHER companies and linking to
them, so articles matching buying intent ("best…", "X vs Y", "how do I block…") are the most
valuable. Never propose an article about installing, downloading or setting up Ask Parent
itself — there is nothing to install. Article ideas must be about parenting, screens, or
third-party apps.`;

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, existing = [], posts = [], seed, title, keywords = [] } = await req.json();

  try {
    if (action === "gaps") {
      const j = await askJson<{ ideas: unknown[] }>(
        `${CONTEXT}

Posts that already exist:
${existing.length ? existing.map((t: string) => `- ${t}`).join("\n") : "(none yet)"}

Suggest 8 NEW articles that would attract search traffic and are NOT already covered above.
Favour queries with clear problem-solving or buying intent over vague informational ones.

Return JSON:
{"ideas":[{"title":"headline as it would appear","keyword":"the exact search query, lowercase",
"intent":"informational|commercial|transactional","why":"one sentence on why this is worth writing",
"difficulty":"easy|medium|hard"}]}

"difficulty" = how hard it would be for a new site to rank. Be realistic: broad head terms are hard.`,
      );
      return NextResponse.json(j);
    }

    if (action === "links") {
      if (posts.length < 2) {
        return NextResponse.json({ links: [], note: "Publish at least two posts first." });
      }
      const j = await askJson<{ links: unknown[] }>(
        `${CONTEXT}

Published posts:
${posts.map((p: { slug: string; title: string }) => `- ${p.title} (/blog/${p.slug})`).join("\n")}

Suggest up to 8 internal links between these posts. Only suggest a link where a reader of the
first post would genuinely want the second. Anchor text must read naturally in a sentence and
must not be "click here" or the bare title.

Return JSON:
{"links":[{"from":"source post title","to":"target post title","anchor":"the phrase to hyperlink",
"why":"one sentence"}]}`,
      );
      return NextResponse.json(j);
    }

    if (action === "keywords") {
      const j = await askJson<{ keywords: string[] }>(
        `${CONTEXT}

Seed topic: "${seed}"

Return 20 long-tail search queries a parent would realistically type into Google around this
topic. Lowercase, no hashtags, no duplicates. Favour specific questions and comparisons over
one-word terms.

Return JSON: {"keywords":["...", "..."]}`,
      );
      return NextResponse.json(j);
    }

    /* ---------------------------------------------------------------------
     * EXTERNAL SOURCES — links OUT of an article.
     *
     * The AI is only trusted to turn a headline into good search terms. Every
     * source returned came back from OpenAlex or the curated authority list,
     * so nothing here is a hallucinated citation.
     * ------------------------------------------------------------------- */
    if (action === "sources") {
      if (!title) return NextResponse.json({ error: "Pick a post first." }, { status: 400 });

      const { queries } = await askJson<{ queries: string[] }>(
        `${CONTEXT}

Article: "${title}"
Target keywords: ${keywords.length ? keywords.join(", ") : "(none given)"}

What would you search an academic database for, to find evidence supporting or challenging the
claims this article will make? Give 3 short scholarly search phrases — use the language
researchers use ("adolescent screen time sleep quality"), not the language parents use.

Return JSON: {"queries":["...","...","..."]}`,
      );

      const found = await Promise.all((queries ?? []).slice(0, 3).map((q) => searchOpenAlex(q, 4)));

      // Interleave the three result sets instead of concatenating them, so each
      // query's top hit outranks every query's fourth hit. Relevance order
      // within a query is preserved — re-sorting by citation count would put
      // famous-but-unrelated papers on top.
      const seen = new Set<string>();
      const unique: Source[] = [];
      for (let rank = 0; rank < 4 && unique.length < 8; rank++) {
        for (const list of found) {
          const p = list[rank];
          if (!p) continue;
          const k = p.doi ?? p.url;
          if (seen.has(k)) continue;
          seen.add(k);
          unique.push(p);
        }
      }

      const authorities = matchAuthorities(
        [...(keywords as string[]), ...String(title).toLowerCase().split(/\s+/)],
        4,
      );

      return NextResponse.json({
        queries,
        sources: [...authorities, ...unique] as Source[],
      });
    }

    /* ---------------------------------------------------------------------
     * OUTREACH — where inbound links could realistically come from.
     * ------------------------------------------------------------------- */
    if (action === "outreach") {
      const j = await askJson<{ targets: unknown[] }>(
        `${CONTEXT}

Articles we have published:
${existing.length ? existing.map((t: string) => `- ${t}`).join("\n") : "(none yet)"}

Suggest 8 realistic places a NEW, small parenting site could actually earn a backlink from
in the next 90 days. Be concrete and honest: no "get featured in Forbes". Favour places that
accept contributions, run link round-ups, curate resources, or answer parent questions.

For each, say what we would offer them and which of our articles is the hook.

Return JSON:
{"targets":[{"name":"site or community name","type":"guest post|resource page|community|directory|round-up|expert quote",
"why":"why they would plausibly say yes","pitch":"one-sentence pitch","effort":"low|medium|high"}]}`,
      );
      return NextResponse.json(j);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Assistant failed" },
      { status: 500 },
    );
  }
}
