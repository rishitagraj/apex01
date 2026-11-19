import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, Clock3 } from "lucide-react";
import { db } from "@/lib/db";
import { Wordmark } from "@/components/brand";
import { estimateReadMinutes, formatBlogDate } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description: "Updates, study tips, and announcements from Apex01.",
};

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const posts = await db.blogPost
    .findMany({
      where: { published: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: { author: { select: { name: true } } },
    })
    .catch(() => [] as const);

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/" aria-label="Apex01 home">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/blog" className="rounded-lg px-3 py-1.5 font-medium text-foreground">
              Blog
            </Link>
            <Link href="/login" className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary btn-sm">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-10 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-apex">Apex01 Blog</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Updates, guides, and study insights</h1>
          <p className="mt-4 text-base leading-7 text-muted">
            Read the latest posts, tips, and announcements from the Apex01 team.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <p className="text-lg font-semibold">No posts published yet</p>
            <p className="mt-2 text-sm text-muted">Check back soon for new updates and articles.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {posts.map((post) => (
              <article key={post.id} className="card group flex h-full flex-col overflow-hidden p-0">
                {post.coverImage ? (
                  <Link href={`/blog/${post.slug}`} className="block border-b border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.coverImage}
                      alt=""
                      className="h-48 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  </Link>
                ) : null}
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={13} /> {formatBlogDate(post.publishedAt ?? post.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 size={13} /> {estimateReadMinutes(post.content)} min read
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold leading-snug tracking-tight">
                    <Link href={`/blog/${post.slug}`} className="transition hover:text-apex">
                      {post.title}
                    </Link>
                  </h2>
                  {post.excerpt ? (
                    <p className="mt-3 flex-1 text-sm leading-6 text-muted">{post.excerpt}</p>
                  ) : (
                    <p className="mt-3 flex-1 text-sm leading-6 text-muted">Read the full post for details.</p>
                  )}
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
                    <p className="text-xs text-muted">By {post.author?.name || "Apex01"}</p>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-apex hover:underline"
                    >
                      Read post <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
