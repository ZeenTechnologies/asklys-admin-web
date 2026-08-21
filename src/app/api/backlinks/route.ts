import { NextResponse } from "next/server";
import { isLoggedIn } from "@/features/auth/services/session";
import {
  deleteBacklink, findByDomain, insertBacklink, insertDetected,
  listReferringDomains, refreshReferrals, updateBacklink, type BacklinkInput,
} from "@/features/backlinks/queries";
import { isRealReferrer, normaliseDomain } from "@/features/backlinks/services/detect";

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // A domain only appears here if somebody actually clicked through from it,
  // which makes this the only backlink data on the page that is verified rather than claimed.
  if (body.action === "sync") {
    let rows;
    try {
      rows = await listReferringDomains(500);
    } catch (e) {
      return NextResponse.json(
        { error: `${(e as Error).message} — have you run db/0002_social_and_backlinks.sql?` },
        { status: 400 },
      );
    }

    const found = rows.filter((r) => isRealReferrer(r.domain));
    let added = 0;

    for (const r of found) {
      const existing = await findByDomain(r.domain);
      if (existing) {
        await refreshReferrals(existing.id, r.sessions, r.last_seen);
      } else {
        await insertDetected(r);
        added++;
      }
    }

    return NextResponse.json({ ok: true, scanned: rows.length, linked: found.length, added });
  }

  if (body.action === "delete") {
    await deleteBacklink(body.id);
    return NextResponse.json({ ok: true });
  }

  if (!body.domain) {
    return NextResponse.json({ error: "A domain is required." }, { status: 400 });
  }

  const row: BacklinkInput = {
    domain: normaliseDomain(body.domain),
    url: body.url || null,
    target_path: body.target_path || null,
    anchor: body.anchor || null,
    kind: body.kind ?? "manual",
    status: body.status ?? "idea",
    authority: body.authority === "" || body.authority == null ? null : Number(body.authority),
    dofollow: body.dofollow ?? true,
    notes: body.notes ?? "",
  };

  try {
    if (body.id) await updateBacklink(body.id, row);
    else await insertBacklink(row);
  } catch (e) {
    const msg =
      (e as { code?: string }).code === "23505"
        ? "That domain + target page is already tracked."
        : `${(e as Error).message} — have you run db/0002_social_and_backlinks.sql?`;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
