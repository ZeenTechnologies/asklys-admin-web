// Every query against social_posts.
import "server-only";
import { q, one } from "@/lib/db";

export type SocialPost = {
  id: string;
  platform: string;
  permalink: string;
  image: string | null;
  caption: string | null;
  alt: string | null;
  post_slug: string | null;
  likes: number;
  position: number;
  active: boolean;
  video: string | null;
  poster: string | null;
  featured: boolean;
  created_at: string;
};

export type SocialInput = Omit<SocialPost, "id" | "created_at">;

export const listSocial = () =>
  q<SocialPost>(`SELECT * FROM social_posts ORDER BY position ASC`);

export const deleteSocial = (id: string) =>
  q(`DELETE FROM social_posts WHERE id = $1`, [id]);

// Only one reel plays at the top, so featuring one un-features the rest.
export const clearFeatured = (exceptId?: string) =>
  exceptId
    ? q(`UPDATE social_posts SET featured = false WHERE id <> $1`, [exceptId])
    : q(`UPDATE social_posts SET featured = false`);

const COLS = [
  "platform", "permalink", "image", "caption", "alt", "post_slug",
  "likes", "position", "active", "video", "poster", "featured",
] as const;

export function insertSocial(row: SocialInput) {
  const values = COLS.map((c) => row[c]);
  return one<{ id: string }>(
    `INSERT INTO social_posts (${COLS.join(", ")})
     VALUES (${COLS.map((_, i) => `$${i + 1}`).join(", ")})
     RETURNING id`,
    values,
  );
}

export function updateSocial(id: string, row: SocialInput) {
  const values = COLS.map((c) => row[c]);
  return one<{ id: string }>(
    `UPDATE social_posts SET ${COLS.map((c, i) => `${c} = $${i + 1}`).join(", ")}
      WHERE id = $${COLS.length + 1}
      RETURNING id`,
    [...values, id],
  );
}
