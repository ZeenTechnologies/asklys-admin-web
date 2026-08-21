// Instagram's oEmbed endpoint needs a Facebook app token, so read the post's
// public Open Graph tags instead to prefill the thumbnail and caption.
// Works for any normal public post; returns {} silently otherwise.

export type OgPreview = { image?: string; caption?: string };

const decode = (s?: string) =>
  s?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export async function scrapeOpenGraph(permalink: string): Promise<OgPreview> {
  try {
    const res = await fetch(permalink, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AskParentBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return {};

    const html = await res.text();
    // Attribute order varies between sites, so try both.
    const meta = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1]
      ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"))?.[1];

    return { image: decode(meta("og:image")) ?? "", caption: decode(meta("og:description")) ?? "" };
  } catch {
    return {};
  }
}
