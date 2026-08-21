// UI option lists for the composer. Runtime values, so they must live outside
// queries.ts — importing that from a client component would pull the pg pool in.
import type { PostType, CardStyle, FontStyle } from "./queries";

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
