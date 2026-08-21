import { notFound } from "next/navigation";
import { requireAuth } from "@/features/auth/services/session";
import { findBySlug } from "@/features/posts/queries";
import { Shell, PageHead } from "@/components/Shell";
import { ComposerLoader } from "@/features/posts/components/ComposerLoader";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAuth();
  const { slug } = await params;
  const data = await findBySlug(slug);
  if (!data) notFound();

  return (
    <Shell>
      <PageHead title="Edit post" subtitle={`/blog/${data.slug}`} />
      <ComposerLoader initial={data} />
    </Shell>
  );
}
