import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { excerptFromMarkdown, slugify } from "@/lib/blog";

async function uniqueSlug(base: string, excludeId: string): Promise<string> {
  const root = slugify(base) || "post";
  let slug = root;
  let i = 2;
  while (true) {
    const existing = await db.blogPost.findFirst({
      where: { slug, id: { not: excludeId } },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${root}-${i++}`;
  }
}

export async function GET(_request: Request, ctx: RouteContext<"/api/admin/blog/[id]">) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: guard.status });
  }

  const { id } = await ctx.params;
  const post = await db.blogPost.findUnique({
    where: { id },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ post });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/blog/[id]">) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: guard.status });
  }

  const { id } = await ctx.params;
  const existing = await db.blogPost.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const data: {
    title?: string;
    slug?: string;
    content?: string;
    excerpt?: string | null;
    coverImage?: string | null;
    published?: boolean;
    publishedAt?: Date | null;
  } = {};

  if (body?.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    data.title = title;
  }
  if (body?.content !== undefined) {
    const content = String(body.content);
    if (!content.trim()) return NextResponse.json({ error: "Content is required." }, { status: 400 });
    data.content = content;
  }
  if (body?.slug !== undefined) {
    const rawSlug = String(body.slug).trim();
    const base = rawSlug || data.title || existing.title;
    data.slug = await uniqueSlug(base, id);
  } else if (data.title && !existing.slug) {
    data.slug = await uniqueSlug(data.title, id);
  }
  if (body?.excerpt !== undefined) {
    const ex = String(body.excerpt ?? "").trim();
    data.excerpt = ex || null;
  } else if (data.content !== undefined && !existing.excerpt) {
    data.excerpt = excerptFromMarkdown(data.content);
  }
  if (body?.coverImage !== undefined) {
    const img = String(body.coverImage ?? "").trim();
    data.coverImage = img || null;
  }
  if (body?.published !== undefined) {
    const published = Boolean(body.published);
    data.published = published;
    if (published && !existing.publishedAt) data.publishedAt = new Date();
    if (!published) data.publishedAt = null;
  }

  const post = await db.blogPost.update({
    where: { id },
    data,
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ post });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/blog/[id]">) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: guard.status });
  }

  const { id } = await ctx.params;
  const existing = await db.blogPost.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.blogPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
