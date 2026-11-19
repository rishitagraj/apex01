import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Clock3, User } from "lucide-react";
import { db } from "@/lib/db";
import { Wordmark } from "@/components/brand";
import { MarkdownContent } from "@/components/markdown-content";
import { estimateReadMinutes, formatBlogDate } from "@/lib/blog";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await db.blogPost.findFirst({
    where: { slug, published: true },
    select: { title: true, excerpt: true },
  });
  if (!post) return { title: "Blog" };
  return {
    title: post.title,
    description: post.excerpt || undefined,
  };
}

export const dynamic = "force-dynamic";

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await db.blogPost.findFirst({
    where: { slug, published: true },
    include: { author: { select: { name: true } } },
  });
  if (!post) notFound();

  const date = formatBlogDate(post.publishedAt ?? post.createdAt);
  const minutes = estimateReadMinutes(post.content);

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
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-foreground">
          <ArrowLeft size={15} /> Back to blog
        </Link>

        <header className="mt-6">
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>
          {post.excerpt ? <p className="mt-4 text-lg leading-8 text-muted">{post.excerpt}</p> : null}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-line py-4 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <User size={15} /> {post.author?.name || "Apex01"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={15} /> {date}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={15} /> {minutes} min read
            </span>
          </div>
        </header>

        {post.coverImage ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.coverImage} alt="" className="max-h-[460px] w-full object-cover" />
          </div>
        ) : null}

        <div className="mt-8">
          <MarkdownContent content={post.content} />
        </div>

        <footer className="mt-12 border-t border-line pt-6">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-apex hover:underline">
            <ArrowLeft size={14} /> More posts
          </Link>
        </footer>
      </article>
    </main>
  );
}
