import { requireAuth } from "@/features/auth/services/session";
import { Shell, PageHead } from "@/components/Shell";
import { ComposerLoader } from "@/features/posts/components/ComposerLoader";

export default async function NewPostPage() {
  await requireAuth();
  return (
    <Shell>
      <PageHead title="New post" subtitle="Write it, style it, publish it." />
      <ComposerLoader />
    </Shell>
  );
}
