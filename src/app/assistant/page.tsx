import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { Shell, PageHead } from "@/components/Shell";
import { AssistantPanel } from "@/components/AssistantPanel";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await requireAuth();
  const db = supabaseAdmin();
  const { data } = await db
    .from("posts")
    .select("slug,title,category,keywords,status")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <Shell>
      <PageHead
        title="AI Assistant"
        subtitle="What to write next, and how to link it together."
      />
      <AssistantPanel posts={data ?? []} />
    </Shell>
  );
}
