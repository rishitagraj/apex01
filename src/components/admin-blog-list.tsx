"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, FileText } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { formatBlogDate } from "@/lib/blog";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published: boolean;
  updatedAt: string | Date;
  publishedAt: string | Date | null;
  author?: { name: string | null; email: string | null } | null;
};

export function AdminBlogList({ initialPosts }: { initialPosts: Post[] }) {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function togglePublish(post: Post) {
    setBusyId(post.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/blog/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !post.published }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update post.");
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...data.post } : p)));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update post.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(post: Post) {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setBusyId(post.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/blog/${post.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete post.");
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete post.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Blog posts</h1>
          <p className="mt-1 text-sm text-muted">Create and publish blog posts for the public blog page.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/blog" target="_blank" className="btn">
            <ExternalLink size={15} /> View blog
          </Link>
          <Link href="/admin/blog/new" className="btn btn-primary">
            <Plus size={16} /> New post
          </Link>
        </div>
      </div>

      {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p> : null}

      {posts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <FileText size={28} className="text-muted" />
          <div>
            <p className="font-semibold">No blog posts yet</p>
            <p className="mt-1 text-sm text-muted">Create your first post to publish it on the blog.</p>
          </div>
          <Link href="/admin/blog/new" className="btn btn-primary mt-1">
            <Plus size={16} /> Create post
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold">{post.title}</h2>
                    {post.published ? <Badge color="success">Published</Badge> : <Badge color="neutral">Draft</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    /blog/{post.slug} · Updated {formatBlogDate(post.updatedAt)}
                    {post.publishedAt ? ` · Published ${formatBlogDate(post.publishedAt)}` : ""}
                  </p>
                  {post.excerpt ? <p className="mt-2 line-clamp-2 text-sm text-muted">{post.excerpt}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {post.published ? (
                    <Link href={`/blog/${post.slug}`} target="_blank" className="btn btn-sm">
                      <ExternalLink size={13} /> View
                    </Link>
                  ) : null}
                  <Button
                    type="button"
                    className="btn-sm"
                    disabled={busyId === post.id}
                    onClick={() => togglePublish(post)}
                    title={post.published ? "Unpublish" : "Publish"}
                  >
                    {post.published ? <EyeOff size={13} /> : <Eye size={13} />}
                    {post.published ? "Unpublish" : "Publish"}
                  </Button>
                  <Link href={`/admin/blog/${post.id}`} className="btn btn-sm">
                    <Pencil size={13} /> Edit
                  </Link>
                  <Button
                    type="button"
                    className="btn-danger btn-sm"
                    disabled={busyId === post.id}
                    onClick={() => remove(post)}
                  >
                    <Trash2 size={13} /> Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="pt-2">
        <Link href="/admin" className="text-sm text-muted hover:text-foreground">← Back to Admin</Link>
      </div>
    </div>
  );
}
