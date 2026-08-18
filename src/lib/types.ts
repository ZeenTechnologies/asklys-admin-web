export type PostType = "article" | "listicle" | "comparison" | "how-to" | "news";
export type CardStyle = "hero" | "standard" | "compact" | "featured";
export type FontStyle = "default" | "serif" | "editorial";
export type PostStatus = "draft" | "scheduled" | "published";

export type FAQItem = { q: string; a: string };

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body_json: unknown;
  body_html: string;
  category: string;
  author: string;
  post_type: PostType;
  card_style: CardStyle;
  font_style: FontStyle;
  cover_image: string;
  cover_alt: string;
  seo_title: string | null;
  seo_description: string | null;
  keywords: string[];
  tags: string[];
  faq: FAQItem[];
  featured: boolean;
  status: PostStatus;
  published_at: string | null;
  scheduled_for: string | null;
  read_mins: number;
  created_at: string;
  updated_at: string;
};

export const CATEGORIES = [
  { slug: "screen-time", name: "Screen Time" },
  { slug: "digital-safety", name: "Digital Safety" },
  { slug: "parenting-teens", name: "Parenting Teens" },
  { slug: "apps-and-social", name: "Apps & Social" },
  { slug: "focus-and-school", name: "Focus & School" },
  { slug: "family-life", name: "Family Life" },
  { slug: "reviews", name: "Reviews" },
] as const;

export const POST_TYPES: { value: PostType; label: string; hint: string }[] = [
  { value: "article", label: "Article", hint: "Standard editorial piece" },
  { value: "listicle", label: "Listicle", hint: "7 ways to… / 10 signs of…" },
  { value: "comparison", label: "Comparison", hint: "X vs Y — highest buying intent" },
  { value: "how-to", label: "How-to guide", hint: "Step-by-step; wins featured snippets" },
  { value: "news", label: "News", hint: "Timely, short shelf life" },
];

export const CARD_STYLES: { value: CardStyle; label: string; hint: string }[] = [
  { value: "hero", label: "Hero", hint: "Big lead story on the homepage" },
  { value: "standard", label: "Standard", hint: "Normal grid card" },
  { value: "compact", label: "Compact", hint: "Small card, more per row" },
  { value: "featured", label: "Featured", hint: "Highlighted with an accent" },
];

export const FONT_STYLES: { value: FontStyle; label: string; hint: string }[] = [
  { value: "default", label: "Default", hint: "Nunito — friendly, matches the site" },
  { value: "serif", label: "Serif", hint: "Editorial, long-read feel" },
  { value: "editorial", label: "Editorial", hint: "Larger type, wider leading" },
];

export const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
