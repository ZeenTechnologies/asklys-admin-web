// Every query against the posts table.
import "server-only";
import { q, one, toVector } from "@/lib/db";
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

// The list view never needs the body, which is by far the largest column.
export type PostListItem = Pick<
  Post,
  "id" | "slug" | "title" | "category" | "post_type" | "status" | "featured" | "published_at" | "updated_at"
>;

export const listPosts = () =>
  q<PostListItem>(
    `SELECT id, slug, title, category, post_type, status, featured, published_at, updated_at
       FROM posts
      ORDER BY updated_at DESC`,
  );

const FULL = `id, slug, title, category, author, post_type, card_style, font_style,
  status, featured, published_at, scheduled_for, created_at, updated_at, body_json,
  seo_title, seo_description,
  coalesce(excerpt, '')      as excerpt,
  coalesce(body_html, '')    as body_html,
  coalesce(cover_image, '')  as cover_image,
  coalesce(cover_alt, '')    as cover_alt,
  coalesce(keywords, '{}')   as keywords,
  coalesce(tags, '{}')       as tags,
  coalesce(faq, '[]'::jsonb) as faq,
  coalesce(read_mins, 1)     as read_mins`;

export const findBySlug = (slug: string) =>
  one<Post>(`SELECT ${FULL} FROM posts WHERE slug = $1`, [slug]);

export const publishedTitles = () =>
  q<{ title: string }>(`SELECT title FROM posts WHERE status = 'published'`);

export const countsByStatus = () =>
  q<{ status: PostStatus; count: string }>(`SELECT status, count(*) FROM posts GROUP BY status`);

// Columns the composer may write. Anything absent is left untouched on update.
const WRITABLE = [
  "slug", "title", "excerpt", "body_json", "body_html", "category", "author",
  "post_type", "card_style", "font_style", "cover_image", "cover_alt",
  "seo_title", "seo_description", "keywords", "tags", "faq",
  "featured", "status", "published_at", "scheduled_for", "read_mins",
] as const;

export type PostInput = Partial<Record<(typeof WRITABLE)[number], unknown>> & {
  embedding?: number[];
};

function columns(input: PostInput) {
  const names: string[] = [];
  const values: unknown[] = [];

  for (const col of WRITABLE) {
    if (input[col] === undefined) continue;
    names.push(col);
    values.push(input[col]);
  }
  // pgvector needs the "[0.1,0.2]" string form, not a JS array.
  if (input.embedding?.length) {
    names.push("embedding");
    values.push(toVector(input.embedding));
  }
  return { names, values };
}

// Throws with err.code === "23505" on a duplicate slug — the caller turns that into a suggestion.
export async function insertPost(input: PostInput): Promise<{ slug: string }> {
  const { names, values } = columns(input);
  const placeholders = names.map((_, i) => `$${i + 1}`);
  const rows = await q<{ slug: string }>(
    `INSERT INTO posts (${names.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING slug`,
    values,
  );
  return rows[0];
}

export async function updatePost(id: string, input: PostInput): Promise<{ slug: string } | null> {
  const { names, values } = columns(input);
  if (!names.length) return one<{ slug: string }>(`SELECT slug FROM posts WHERE id = $1`, [id]);

  const assignments = names.map((n, i) => `${n} = $${i + 1}`);
  const rows = await q<{ slug: string }>(
    `UPDATE posts SET ${assignments.join(", ")}, updated_at = now()
      WHERE id = $${names.length + 1}
      RETURNING slug`,
    [...values, id],
  );
  return rows[0] ?? null;
}

// First free variant of a taken slug: my-post -> my-post-2, -3, ...
export async function freeSlug(base: string): Promise<string> {
  const stem = base.replace(/-\d+$/, "");
  const rows = await q<{ slug: string }>(`SELECT slug FROM posts WHERE slug LIKE $1`, [`${stem}%`]);
  const taken = new Set(rows.map((r) => r.slug));

  for (let n = 2; n < 50; n++) {
    const candidate = `${stem}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem}-${Date.now().toString().slice(-5)}`;
}

export type PostBody = { id: string; slug: string; title: string; body_html: string | null };

export const findBodyBySlug = (slug: string) =>
  one<PostBody>(`SELECT id, slug, title, body_html FROM posts WHERE slug = $1`, [slug]);

export const listBodies = () =>
  q<PostBody>(`SELECT id, slug, title, body_html FROM posts`);

// body_json is cleared so the composer re-parses the markdown, keeping it the single source of truth.
export const replaceBody = (id: string, markdown: string) =>
  q(`UPDATE posts SET body_html = $1, body_json = NULL, updated_at = now() WHERE id = $2`, [markdown, id]);

export const postsForFilter = () =>
  q<{ slug: string; title: string; category: string }>(
    `SELECT slug, title, category FROM posts ORDER BY title`,
  );
