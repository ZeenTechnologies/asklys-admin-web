// The media library.
import "server-only";
import { q, one } from "@/lib/db";

export type MediaItem = {
  id: string;
  url: string;
  path: string;
  alt: string;
  width: number | null;
  height: number | null;
  size_bytes: number;
  created_at: string;
};

export const listMedia = (limit = 200) =>
  q<MediaItem>(
    `SELECT id, url, width, height, created_at,
            coalesce(path, '')      as path,
            coalesce(alt, '')       as alt,
            coalesce(size_bytes, 0) as size_bytes
       FROM media
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );

export const findMediaByPath = (path: string) =>
  one<{ path: string }>(`SELECT path FROM media WHERE path = $1`, [path]);

export const insertMedia = (m: { url: string; path: string; alt: string; size_bytes: number }) =>
  q(`INSERT INTO media (url, path, alt, size_bytes) VALUES ($1, $2, $3, $4)`,
    [m.url, m.path, m.alt, m.size_bytes]);

export const deleteMediaByPath = (path: string) =>
  q(`DELETE FROM media WHERE path = $1`, [path]);
