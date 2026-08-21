// Backlinks and the referring-domains view they're detected from.
import "server-only";
import { q, one } from "@/lib/db";

export type Backlink = {
  id: string;
  domain: string;
  url: string | null;
  target_path: string | null;
  anchor: string | null;
  kind: string;
  status: string;
  authority: number | null;
  dofollow: boolean;
  referrals: number;
  first_seen: string;
  last_seen: string | null;
  notes: string;
};

export type ReferringDomain = {
  domain: string;
  sessions: number;
  visitors: number;
  landing_pages: number;
  first_seen: string;
  last_seen: string;
};

export const listBacklinks = () =>
  q<Backlink>(
    `SELECT id, domain, url, target_path, anchor, kind, status, authority,
            dofollow, referrals, last_seen,
            coalesce(notes, '')             as notes,
            coalesce(first_seen, created_at) as first_seen
       FROM backlinks
      ORDER BY referrals DESC`,
  );

export const listReferringDomains = (limit = 100) =>
  q<ReferringDomain>(`SELECT * FROM referring_domains LIMIT $1`, [limit]);

export const findByDomain = (domain: string) =>
  one<{ id: string; kind: string }>(`SELECT id, kind FROM backlinks WHERE domain = $1 LIMIT 1`, [domain]);

// Refresh the referral count without touching a manually-entered status.
export const refreshReferrals = (id: string, referrals: number, lastSeen: string) =>
  q(`UPDATE backlinks SET referrals = $1, last_seen = $2 WHERE id = $3`, [referrals, lastSeen, id]);

export const insertDetected = (r: ReferringDomain) =>
  q(
    `INSERT INTO backlinks (domain, kind, status, referrals, first_seen, last_seen, notes)
     VALUES ($1, 'detected', 'live', $2, $3, $4, $5)`,
    [
      r.domain,
      r.sessions,
      r.first_seen,
      r.last_seen,
      `Auto-detected from ${r.sessions} referred session${r.sessions === 1 ? "" : "s"}.`,
    ],
  );

export const deleteBacklink = (id: string) => q(`DELETE FROM backlinks WHERE id = $1`, [id]);

const COLS = ["domain", "url", "target_path", "anchor", "kind", "status", "authority", "dofollow", "notes"] as const;
export type BacklinkInput = Pick<Backlink, (typeof COLS)[number]>;

export const insertBacklink = (row: BacklinkInput) =>
  q(
    `INSERT INTO backlinks (${COLS.join(", ")}) VALUES (${COLS.map((_, i) => `$${i + 1}`).join(", ")})`,
    COLS.map((c) => row[c]),
  );

export const updateBacklink = (id: string, row: BacklinkInput) =>
  q(
    `UPDATE backlinks SET ${COLS.map((c, i) => `${c} = $${i + 1}`).join(", ")} WHERE id = $${COLS.length + 1}`,
    [...COLS.map((c) => row[c]), id],
  );
