import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { excerptFromMarkdown, slugify } from "@/lib/blog";

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "post";
  let slug = root;
  let i = 2;
  while (true) {
    const existing = await db.blogPost.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${root}-${i++}`;
  }
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: guard.status });
  }

  const posts = await db.blogPost.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: guard.status });
  }

  const body = await request.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  const content = String(body?.content ?? "");
  const rawSlug = String(body?.slug ?? "").trim();
  const excerptInput = String(body?.excerpt ?? "").trim();
  const coverImage = String(body?.coverImage ?? "").trim();
  const published = Boolean(body?.published);

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (!content.trim()) {
    return NextResponse.json({ error: "Content is required." }, { status: 400 });
  }

  const slug = await uniqueSlug(rawSlug || title);
  const excerpt = excerptInput || excerptFromMarkdown(content);
  const now = new Date();

  const post = await db.blogPost.create({
    data: {
      title,
      slug,
      content,
      excerpt: excerpt || null,
      coverImage: coverImage || null,
      published,
      authorId: guard.admin.id,
      publishedAt: published ? now : null,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ post }, { status: 201 });
}
