import Link from "next/link";
import { Eye } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { Shell, PageHead } from "@/components/Shell";
import type { Post } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-700",
  draft: "bg-amber-50 text-amber-700",
  scheduled: "bg-sky-50 text-sky-700",
};

// This is a server component, so the preview secret is only ever used to build
// the href — it is not shipped to the browser as a variable.
const BLOG = process.env.BLOG_URL ?? "";
const SECRET = process.env.REVALIDATE_SECRET ?? "";

export default async function PostsPage() {
  await requireAuth();
  const db = supabaseAdmin();
  const { data } = await db
    .from("posts")
    .select("id,slug,title,category,post_type,status,featured,published_at,updated_at")
    .order("updated_at", { ascending: false });

  const posts = (data ?? []) as Partial<Post>[];

  return (
    <Shell>
      <PageHead
        title="Posts"
        subtitle={`${posts.length} total`}
        action={
          <Link href="/posts/new" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-mid transition-colors">
            New post
          </Link>
        }
      />

      <div className="p-8">
        {posts.length === 0 ? (
          <div className="rounded-xl border border-line bg-white p-12 text-center">
            <p className="font-extrabold text-ink text-lg">No posts yet</p>
            <p className="mt-1 text-[15px] text-muted">Write the first one and it appears here.</p>
            <Link href="/posts/new" className="mt-5 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-mid transition-colors">
              New post
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-white overflow-hidden">
            <table className="w-full text-[14px]">
              <thead className="bg-wash text-left">
                <tr>
                  <th className="px-5 py-3 font-extrabold text-ink">Title</th>
                  <th className="px-3 py-3 font-extrabold text-ink">Category</th>
                  <th className="px-3 py-3 font-extrabold text-ink">Type</th>
                  <th className="px-3 py-3 font-extrabold text-ink">Status</th>
                  <th className="px-3 py-3 font-extrabold text-ink">Updated</th>
                  <th className="px-5 py-3 font-extrabold text-ink"></th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-t border-line hover:bg-wash/60">
                    <td className="px-5 py-3.5">
                      <Link href={`/posts/${p.slug}`} className="font-bold text-ink hover:text-brand">
                        {p.title}
                      </Link>
                      {p.featured && (
                        <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-accent">
                          Featured
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-body">{p.category}</td>
                    <td className="px-3 py-3.5 text-body capitalize">{p.post_type}</td>
                    <td className="px-3 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase ${STATUS_STYLE[p.status ?? "draft"]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-muted">
                      {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      {/* drafts open the signed preview; live posts open the real page */}
                      <a
                        href={
                          p.status === "published"
                            ? `${BLOG}/blog/${p.slug}`
                            : `${BLOG}/preview/${p.slug}?token=${encodeURIComponent(SECRET)}`
                        }
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-brand hover:underline"
                      >
                        <Eye size={13} />
                        {p.status === "published" ? "View" : "Preview"}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
