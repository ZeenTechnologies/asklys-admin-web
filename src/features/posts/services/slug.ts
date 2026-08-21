// Slug generation. slugify runs in the browser as you type; freeSlug resolves collisions server-side.
export const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
