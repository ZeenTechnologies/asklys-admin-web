/**
 * AI layer — Groq for text work, Gemini as the backstop + embeddings.
 *
 * Verified working 2026-08-17:
 *   Groq   : openai/gpt-oss-120b  ✅  ~1s, 131k context
 *            openai/gpt-oss-20b   ✅  faster, used if 120b is busy
 *   Gemini : gemini-flash-latest (generate)   ✅
 *            gemini-embedding-001 (768 dims)  ✅
 *
 * Two lessons baked in here:
 *  - Hosted model names get RETIRED without warning. Groq dropped
 *    `llama-3.3-70b-versatile` (404s), and Google dropped `gemini-2.0-flash` /
 *    `gemini-2.5-flash` for new keys. Hence a LIST of models, not one, and a
 *    clear error naming the model when they all go.
 *  - Free tiers return 503/429 under load. Everything retries with backoff
 *    before giving up, so a momentary spike doesn't surface to the editor.
 *
 * Avoid `qwen/qwen3.6-27b` here: it emits <think>…</think> reasoning inline,
 * which breaks askJson.
 */

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";

/** Tried in order; first one that answers wins. */
const GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "groq/compound"];
const GEMINI_MODEL = "gemini-flash-latest";
const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIMS = 768; // must match vector(768) in the schema

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 503/429 mean "busy, come back" — worth another go. 4xx don't. */
const isTransient = (status: number) => status === 429 || status === 500 || status === 503;

async function groqOnce(model: string, prompt: string, system?: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });
  if (res.ok) {
    const j = await res.json();
    const text = j.choices?.[0]?.message?.content;
    if (text) return { text, status: res.status };
  }
  return { text: "", status: res.status, body: (await res.text()).slice(0, 200) };
}

/**
 * Ask Groq, then Gemini. Collects every failure so the error the editor sees
 * names all of them — the old version reported only Gemini's, which made a
 * dead Groq model look like a Google outage.
 */
export async function ask(prompt: string, system?: string): Promise<string> {
  const failures: string[] = [];

  if (GROQ_KEY) {
    for (const model of GROQ_MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await groqOnce(model, prompt, system);
          if (r.text) return r.text;
          if (isTransient(r.status) && attempt === 0) {
            await sleep(700);
            continue; // same model, one more go
          }
          failures.push(`Groq ${model}: ${r.status}${r.status === 404 ? " (model retired)" : ""}`);
          break; // move to the next model
        } catch (e) {
          failures.push(`Groq ${model}: ${e instanceof Error ? e.message : "network error"}`);
          break;
        }
      }
    }
  } else {
    failures.push("Groq: no GROQ_API_KEY set");
  }

  try {
    return await askGemini(prompt, system);
  } catch (e) {
    failures.push(e instanceof Error ? e.message : "Gemini failed");
    throw new Error(`Every AI provider failed — ${failures.join(" · ")}`);
  }
}

export async function askGemini(prompt: string, system?: string): Promise<string> {
  if (!GEMINI_KEY) throw new Error("Gemini: no GEMINI_API_KEY set");

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: system ? `${system}\n\n${prompt}` : prompt }] }],
        }),
      },
    );

    if (res.ok) {
      const j = await res.json();
      return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }

    // Google's free tier 503s when the model is busy; back off and retry.
    if (isTransient(res.status) && attempt < 2) {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    throw new Error(
      `Gemini ${GEMINI_MODEL}: ${res.status}${res.status === 503 ? " (overloaded)" : ""}`,
    );
  }
  throw new Error(`Gemini ${GEMINI_MODEL}: still overloaded after 3 tries`);
}

/**
 * Ask for JSON and parse it, tolerating the three things models actually do:
 * wrap it in code fences, prepend a sentence of preamble, or emit a
 * <think>…</think> reasoning block first.
 */
export async function askJson<T>(prompt: string, system?: string): Promise<T> {
  const raw = await ask(
    prompt,
    (system ?? "") + "\nRespond with valid JSON only. No commentary, no code fences.",
  );

  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")   // reasoning models
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // grab the outermost {...} or [...] — handles a preamble sentence
    const m = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch { /* fall through to the error below */ }
    }
    throw new Error(`AI did not return JSON: ${cleaned.slice(0, 200)}`);
  }
}

/** Embed text for the "related posts" recommendations. */
export async function embed(text: string): Promise<number[]> {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY missing");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: text.slice(0, 8000) }] },
        outputDimensionality: EMBED_DIMS,
      }),
    },
  );
  if (!res.ok) throw new Error(`Embedding failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.embedding?.values ?? [];
}
