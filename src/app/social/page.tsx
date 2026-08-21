import { requireAuth } from "@/features/auth/services/session";
import { listSocial } from "@/features/social/queries";
import { Shell, PageHead } from "@/components/Shell";
import { SocialManager, type SocialRow } from "@/features/social/components/SocialManager";

export const dynamic = "force-dynamic";

export default async function SocialPage() {
  await requireAuth();
  const data = await listSocial();

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
