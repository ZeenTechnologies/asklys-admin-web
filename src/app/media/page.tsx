import { requireAuth } from "@/features/auth/services/session";
import { listMedia } from "@/features/media/queries";
import { Shell, PageHead } from "@/components/Shell";
import { MediaLibrary } from "@/features/media/components/MediaLibrary";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  await requireAuth();
  const data = await listMedia(200);

  return (
    <Shell>
      <PageHead title="Media" subtitle={`${(data ?? []).length} images · copy a URL to use it in a post`} />
      <MediaLibrary items={data ?? []} />
    </Shell>
  );
}
