import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { deleteObject, objectKey, publicUrl, putObject } from "@/lib/storage";

const MAX_BYTES = 10 * 1024 * 1024;

// file.type is browser-supplied; the extension allowlist is what stops a script-bearing .svg.
const ALLOWED = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

// Upload an image to object storage and record it in the media table.
export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const alt = String(form.get("alt") ?? "");

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Images only" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Max file size is 10MB" }, { status: 400 });
  }

  const key = objectKey(file.name);
  const ext = key.split(".").pop() ?? "";
  if (!ALLOWED.has(ext)) {
    return NextResponse.json(
      { error: `Unsupported image type ".${ext}" — use ${[...ALLOWED].join(", ")}` },
      { status: 400 },
    );
  }

  const body = Buffer.from(await file.arrayBuffer());

  try {
    await putObject(key, body, file.type);
  } catch (e) {
    console.error("[upload] storage write failed:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }

  const url = publicUrl(key);

  try {
    await q(
      `INSERT INTO media (url, path, alt, size_bytes) VALUES ($1, $2, $3, $4)`,
      [url, key, alt, file.size],
    );
  } catch (e) {
    // Roll back: a stored object with no row is invisible in the library and undeletable.
    console.error("[upload] media row failed, rolling back the object:", e);
    await deleteObject(key).catch(() => {});
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url, path: key });
}

// Delete an image: object first, then the record.
export async function DELETE(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await req.json();
  if (!path) return NextResponse.json({ error: "No path" }, { status: 400 });

  // path comes from the client; unchecked it would allow deleting any key in the bucket.
  const row = await one<{ path: string }>(`SELECT path FROM media WHERE path = $1`, [path]);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteObject(row.path);
  await q(`DELETE FROM media WHERE path = $1`, [row.path]);

  return NextResponse.json({ ok: true });
}
