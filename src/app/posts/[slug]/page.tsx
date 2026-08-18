import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { Shell, PageHead } from "@/components/Shell";
import { ComposerLoader } from "@/components/ComposerLoader";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAuth();
  const { slug } = await params;
  const db = supabaseAdmin();
  const { data } = await db.from("posts").select("*").eq("slug", slug).single();
  if (!data) notFound();

  return (
    <Shell>
      <PageHead title="Edit post" subtitle={`/blog/${data.slug}`} />
      <ComposerLoader initial={data} />
    </Shell>
  );
}
