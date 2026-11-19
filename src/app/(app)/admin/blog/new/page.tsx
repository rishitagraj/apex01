import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { BlogEditor } from "@/components/blog-editor";

export const metadata: Metadata = { title: "New Blog Post" };
export const dynamic = "force-dynamic";

export default async function NewBlogPostPage() {
  const { user } = await getAuthUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New blog post</h1>
        <p className="mt-1 text-sm text-muted">Write and format a post, then publish it to the blog.</p>
      </div>
      <BlogEditor mode="create" />
    </div>
  );
}
