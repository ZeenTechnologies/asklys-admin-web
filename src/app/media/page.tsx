import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { Shell, PageHead } from "@/components/Shell";
import { MediaLibrary } from "@/components/MediaLibrary";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  await requireAuth();
  const db = supabaseAdmin();
  const { data } = await db.from("media").select("*").order("created_at", { ascending: false }).limit(200);

  return (
    <Shell>
      <PageHead title="Media" subtitle={`${(data ?? []).length} images · copy a URL to use it in a post`} />
      <MediaLibrary items={data ?? []} />
    </Shell>
  );
}
