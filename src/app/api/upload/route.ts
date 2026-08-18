import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/** Upload an image to Supabase Storage and record it in the media table. */
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
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Max file size is 10MB" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const safe = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const path = `${new Date().getFullYear()}/${Date.now()}-${safe}.${ext}`;

  const db = supabaseAdmin();
  const { error: upErr } = await db.storage
    .from("media")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  const { data: pub } = db.storage.from("media").getPublicUrl(path);

  await db.from("media").insert({
    url: pub.publicUrl,
    path,
    alt,
    size_bytes: file.size,
  });

  return NextResponse.json({ ok: true, url: pub.publicUrl, path });
}

/** Delete an image (storage + record). */
export async function DELETE(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { path } = await req.json();
  if (!path) return NextResponse.json({ error: "No path" }, { status: 400 });

  const db = supabaseAdmin();
  await db.storage.from("media").remove([path]);
  await db.from("media").delete().eq("path", path);
  return NextResponse.json({ ok: true });
}
