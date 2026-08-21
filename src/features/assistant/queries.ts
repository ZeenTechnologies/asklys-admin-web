// Assistant reads: post titles for gap analysis, and the citation log.
import "server-only";
import { q } from "@/lib/db";

export type AssistantPost = {
  slug: string;
  title: string;
  category: string;
  keywords: string[];
  status: string;
};

export const postsForAssistant = (limit = 200) =>
  q<AssistantPost>(
    `SELECT slug, title, category, status, coalesce(keywords, '{}') as keywords
       FROM posts
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );

export const recordCitation = (c: {
  post_slug: string;
  title: string;
  url: string;
  publisher?: string | null;
  year?: number | null;
  doi?: string | null;
}) =>
  q(
    `INSERT INTO citations (post_slug, title, url, publisher, year, doi, applied)
     VALUES ($1, $2, $3, $4, $5, $6, true)`,
    [c.post_slug, c.title, c.url, c.publisher ?? "", c.year ?? null, c.doi ?? null],
  );

export const citationsFor = (slug: string) =>
  q(`SELECT * FROM citations WHERE post_slug = $1 ORDER BY created_at DESC`, [slug]);
