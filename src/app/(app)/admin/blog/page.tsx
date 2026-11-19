import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { AdminBlogList } from "@/components/admin-blog-list";

export const metadata: Metadata = { title: "Blog Admin" };
export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const { user } = await getAuthUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/dashboard");

  const posts = await db.blogPost.findMany({
    orderBy: { updatedAt: "desc" },
    include: { author: { select: { name: true, email: true } } },
  });

  return <AdminBlogList initialPosts={posts} />;
}
