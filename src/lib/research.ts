/**
 * Real external sources.
 *
 * An LLM asked for "citations" will happily invent papers that do not exist,
 * and a fabricated citation is worse than none — it is exactly the kind of
 * thing that gets a site classed as unreliable. So the AI only ever proposes
 * SEARCH TERMS here; every source that reaches the editor came back from a
 * real catalogue and has a resolvable URL.
 *
 * OpenAlex indexes ~250M scholarly works, needs no API key, and asks only that
 * you send an email in the User-Agent so they can contact heavy users.
 * https://docs.openalex.org
 */

export type Source = {
  title: string;
  url: string;
  publisher: string;
  year: number | null;
  doi: string | null;
  citedBy: number;
  kind: "paper" | "authority";
};

const UA = "AskParent/1.0 (mailto:hello@askparent.com)";

/**
 * Peer-reviewed work matching a query, most RELEVANT first.
 *
 * Deliberately no `sort=cited_by_count` — sorting a topic search by citations
 * surfaces famous papers that merely mention the words (a search for
 * "adolescent screen time sleep" returns the PRISMA checklist and hypertension
 * guidelines). OpenAlex's default relevance ranking is far better here.
 */
export async function searchOpenAlex(query: string, limit = 5): Promise<Source[]> {
  const url =
    `https://api.openalex.org/works?search=${encodeURIComponent(query)}` +
    `&filter=from_publication_date:2015-01-01,has_doi:true` +
    `&per_page=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const json = await res.json();

    return (json.results ?? []).map((w: Record<string, unknown>): Source => {
      const loc = w.primary_location as Record<string, unknown> | null;
      const src = loc?.source as Record<string, unknown> | null;
      const doi = (w.doi as string | null)?.replace("https://doi.org/", "") ?? null;
      return {
        title: (w.display_name as string) ?? "Untitled",
        // prefer a free full text, fall back to the DOI landing page
        url:
          ((w.best_oa_location as Record<string, unknown> | null)?.landing_page_url as string) ||
          (w.doi as string) ||
          (loc?.landing_page_url as string) ||
          "",
        publisher: (src?.display_name as string) ?? "",
        year: (w.publication_year as number) ?? null,
        doi,
        citedBy: (w.cited_by_count as number) ?? 0,
        kind: "paper",
      };
    }).filter((s: Source) => s.url);
  } catch {
    return [];
  }
}

/**
 * Hand-curated public-health and regulator pages. These are the links that
 * actually persuade a reader (and a Google quality rater) that a parenting
 * claim is grounded — and they never rot, unlike a random blog.
 */
export const AUTHORITIES: (Source & { topics: string[] })[] = [
  {
    title: "Screen time and children — American Academy of Pediatrics",
    url: "https://www.aap.org/en/patient-care/media-and-children/",
    publisher: "American Academy of Pediatrics",
    year: null, doi: null, citedBy: 0, kind: "authority",
    topics: ["screen time", "limits", "age", "toddler", "guidelines", "health"],
  },
  {
    title: "Guidelines on physical activity, sedentary behaviour and sleep (under 5s)",
    url: "https://www.who.int/publications/i/item/9789241550536",
    publisher: "World Health Organization",
    year: 2019, doi: null, citedBy: 0, kind: "authority",
    topics: ["screen time", "sleep", "toddler", "guidelines", "young children"],
  },
  {
    title: "Children and parents: media use and attitudes report",
    url: "https://www.ofcom.org.uk/media-use-and-attitudes/media-habits-children/",
    publisher: "Ofcom (UK regulator)",
    year: null, doi: null, citedBy: 0, kind: "authority",
    topics: ["statistics", "uk", "social media", "usage", "teens", "apps"],
  },
  {
    title: "Teens, Social Media and Technology",
    url: "https://www.pewresearch.org/internet/2024/12/12/teens-social-media-and-technology-2024/",
    publisher: "Pew Research Center",
    year: 2024, doi: null, citedBy: 0, kind: "authority",
    topics: ["statistics", "teens", "social media", "tiktok", "instagram", "usage"],
  },
  {
    title: "Common Sense Census: Media Use by Tweens and Teens",
    url: "https://www.commonsensemedia.org/research/the-common-sense-census-media-use-by-tweens-and-teens-2021",
    publisher: "Common Sense Media",
    year: 2021, doi: null, citedBy: 0, kind: "authority",
    topics: ["statistics", "tweens", "teens", "screen time", "usage"],
  },
  {
    title: "Social Media and Youth Mental Health — Surgeon General's Advisory",
    url: "https://www.hhs.gov/surgeongeneral/priorities/youth-mental-health/social-media/index.html",
    publisher: "US Surgeon General",
    year: 2023, doi: null, citedBy: 0, kind: "authority",
    topics: ["mental health", "social media", "teens", "anxiety", "depression"],
  },
  {
    title: "Screen time and children — NHS advice",
    url: "https://www.nhs.uk/live-well/",
    publisher: "NHS",
    year: null, doi: null, citedBy: 0, kind: "authority",
    topics: ["health", "sleep", "uk", "screen time"],
  },
  {
    title: "Online safety guidance for parents and carers",
    url: "https://www.internetmatters.org/",
    publisher: "Internet Matters",
    year: null, doi: null, citedBy: 0, kind: "authority",
    topics: ["online safety", "parental controls", "digital safety", "settings"],
  },
  {
    title: "Sleep and technology — Sleep Foundation",
    url: "https://www.sleepfoundation.org/children-and-sleep",
    publisher: "Sleep Foundation",
    year: null, doi: null, citedBy: 0, kind: "authority",
    topics: ["sleep", "bedtime", "routine", "blue light"],
  },
  {
    title: "Family Safety Center — how Google's parental controls work",
    url: "https://families.google/familylink/",
    publisher: "Google",
    year: null, doi: null, citedBy: 0, kind: "authority",
    topics: ["parental controls", "android", "family link", "settings", "how-to"],
  },
];

/** Curated authorities whose topics overlap the given keywords. */
export function matchAuthorities(keywords: string[], limit = 4): Source[] {
  const needles = keywords.map((k) => k.toLowerCase());
  return AUTHORITIES
    .map((a) => ({
      a,
      score: a.topics.reduce((n, t) => n + (needles.some((k) => k.includes(t) || t.includes(k)) ? 1 : 0), 0),
    }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map(({ a }) => {
      const { topics: _topics, ...source } = a;
      void _topics;
      return source;
    });
}
