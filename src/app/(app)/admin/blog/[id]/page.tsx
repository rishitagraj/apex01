import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { BlogEditor } from "@/components/blog-editor";

export const metadata: Metadata = { title: "Edit Blog Post" };
export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await getAuthUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/dashboard");

  const { id } = await params;
  const post = await db.blogPost.findUnique({ where: { id } });
  if (!post) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit blog post</h1>
        <p className="mt-1 text-sm text-muted">Update content, formatting, and publish settings.</p>
      </div>
      <BlogEditor
        mode="edit"
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? "",
          coverImage: post.coverImage ?? "",
          content: post.content,
          published: post.published,
        }}
      />
    </div>
  );
}
