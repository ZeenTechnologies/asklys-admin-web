import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { Shell, PageHead } from "@/components/Shell";
import { SocialManager, type SocialRow } from "@/components/SocialManager";

export const dynamic = "force-dynamic";

export default async function SocialPage() {
  await requireAuth();
  const db = supabaseAdmin();
  const { data } = await db.from("social_posts").select("*").order("position", { ascending: true });

  return (
    <Shell>
      <PageHead
        title="Social"
        subtitle="The Instagram grid on the blog homepage — and the posts that link back to your articles."
      />
      <SocialManager rows={(data ?? []) as SocialRow[]} />
    </Shell>
  );
}
