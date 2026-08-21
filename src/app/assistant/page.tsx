import { requireAuth } from "@/features/auth/services/session";
import { postsForAssistant } from "@/features/assistant/queries";
import { Shell, PageHead } from "@/components/Shell";
import { AssistantPanel } from "@/features/assistant/components/AssistantPanel";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await requireAuth();
  const data = await postsForAssistant(200);

  return (
    <Shell>
      <PageHead
        title="AI Assistant"
        subtitle="What to write next, and how to link it together."
      />
      <AssistantPanel posts={data} />
    </Shell>
  );
}
