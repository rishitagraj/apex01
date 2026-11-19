"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Image,
  Code,
  Minus,
  Eye,
  EyeOff,
  Save,
  ArrowLeft,
} from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";
import { MarkdownContent } from "@/components/markdown-content-client";

type BlogForm = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  content: string;
  published: boolean;
};

function withSelection(
  textarea: HTMLTextAreaElement,
  fn: (value: string, start: number, end: number) => { value: string; start: number; end: number },
) {
  const { selectionStart, selectionEnd, value } = textarea;
  const result = fn(value, selectionStart ?? 0, selectionEnd ?? 0);
  return result;
}

export function BlogEditor({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: Partial<BlogForm> & { id?: string };
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [form, setForm] = useState<BlogForm>({
    id: initial?.id,
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    excerpt: initial?.excerpt ?? "",
    coverImage: initial?.coverImage ?? "",
    content: initial?.content ?? "",
    published: initial?.published ?? false,
  });
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSave = useMemo(() => form.title.trim() && form.content.trim(), [form.title, form.content]);

  function update<K extends keyof BlogForm>(key: K, value: BlogForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyEdit(
    edit: (value: string, start: number, end: number) => { value: string; start: number; end: number },
  ) {
    const el = textareaRef.current;
    if (!el) return;
    const next = withSelection(el, edit);
    update("content", next.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.start, next.end);
    });
  }

  function wrap(before: string, after = before, placeholder = "text") {
    applyEdit((value, start, end) => {
      const selected = value.slice(start, end) || placeholder;
      const insertion = `${before}${selected}${after}`;
      const nextValue = value.slice(0, start) + insertion + value.slice(end);
      const innerStart = start + before.length;
      const innerEnd = innerStart + selected.length;
      return { value: nextValue, start: innerStart, end: innerEnd };
    });
  }

  function prefix(linePrefix: string, placeholder = "") {
    applyEdit((value, start, end) => {
      const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const lineEndIdx = value.indexOf("\n", end);
      const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
      const block = value.slice(lineStart, lineEnd);
      const lines = block.split("\n");
      const allPrefixed = lines.every((l) => l.startsWith(linePrefix));
      const nextLines = lines.map((l, idx) => {
        if (allPrefixed) return l.startsWith(linePrefix) ? l.slice(linePrefix.length) : l;
        if (l.trim() === "" && placeholder && idx === 0) return `${linePrefix}${placeholder}`;
        return `${linePrefix}${l || (idx === 0 ? placeholder : "")}`;
      });
      const nextBlock = nextLines.join("\n");
      const nextValue = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);
      return { value: nextValue, start: lineStart, end: lineStart + nextBlock.length };
    });
  }

  function insertBlock(block: string) {
    applyEdit((value, start, end) => {
      const before = value.slice(0, start);
      const after = value.slice(end);
      const padBefore = before && !before.endsWith("\n") ? "\n" : "";
      const padAfter = after && !after.startsWith("\n") ? "\n" : "";
      const insertion = `${padBefore}${block}${padAfter}`;
      const nextValue = before + insertion + after;
      const pos = before.length + insertion.length;
      return { value: nextValue, start: pos, end: pos };
    });
  }

  function insertLink() {
    const url = window.prompt("Enter URL (https://...)");
    if (!url) return;
    applyEdit((value, start, end) => {
      const label = value.slice(start, end) || "link text";
      const insertion = `[${label}](${url})`;
      const nextValue = value.slice(0, start) + insertion + value.slice(end);
      return { value: nextValue, start: start + 1, end: start + 1 + label.length };
    });
  }

  function insertImage() {
    const url = window.prompt("Enter image URL (https://...)");
    if (!url) return;
    const alt = window.prompt("Alt text (optional)") || "image";
    insertBlock(`![${alt}](${url})`);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!canSave) {
      setError("Title and content are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        excerpt: form.excerpt.trim(),
        coverImage: form.coverImage.trim(),
        content: form.content,
        published: form.published,
      };
      const res = await fetch(
        mode === "create" ? "/api/admin/blog" : `/api/admin/blog/${form.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save the post.");
        return;
      }
      if (mode === "create" && data.post?.id) {
        router.push(`/admin/blog/${data.post.id}`);
      } else {
        router.push("/admin/blog");
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const tools = [
    { label: "Bold", icon: Bold, action: () => wrap("**") },
    { label: "Italic", icon: Italic, action: () => wrap("*") },
    { label: "Heading 1", icon: Heading1, action: () => prefix("# ", "Heading") },
    { label: "Heading 2", icon: Heading2, action: () => prefix("## ", "Heading") },
    { label: "Heading 3", icon: Heading3, action: () => prefix("### ", "Heading") },
    { label: "Bulleted list", icon: List, action: () => prefix("- ", "List item") },
    { label: "Numbered list", icon: ListOrdered, action: () => prefix("1. ", "List item") },
    { label: "Quote", icon: Quote, action: () => prefix("> ", "Quote") },
    { label: "Link", icon: Link2, action: insertLink },
    { label: "Image", icon: Image, action: insertImage },
    { label: "Inline code", icon: Code, action: () => wrap("`") },
    { label: "Divider", icon: Minus, action: () => insertBlock("---") },
  ];

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/blog" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={15} /> Back to blog posts
        </Link>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => setPreview((p) => !p)}>
            {preview ? <EyeOff size={16} /> : <Eye size={16} />} {preview ? "Hide preview" : "Preview"}
          </Button>
          <Button type="submit" className="btn-primary" disabled={saving || !canSave}>
            <Save size={16} /> {saving ? "Saving…" : mode === "create" ? "Create post" : "Save changes"}
          </Button>
        </div>
      </div>

      {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p> : null}

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="blog-title">Title</Label>
            <Input
              id="blog-title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Post title"
              required
            />
          </div>
          <div>
            <Label htmlFor="blog-slug">Slug (URL)</Label>
            <Input
              id="blog-slug"
              value={form.slug}
              onChange={(e) => update("slug", e.target.value)}
              placeholder="auto-from-title"
            />
            <p className="mt-1 text-xs text-muted">Leave blank to generate from the title.</p>
          </div>
          <div>
            <Label htmlFor="blog-cover">Cover image URL (optional)</Label>
            <Input
              id="blog-cover"
              value={form.coverImage}
              onChange={(e) => update("coverImage", e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="blog-excerpt">Excerpt (optional)</Label>
            <textarea
              id="blog-excerpt"
              value={form.excerpt}
              onChange={(e) => update("excerpt", e.target.value)}
              placeholder="Short summary shown on the blog list (auto-generated if empty)."
              rows={2}
              className="input min-h-[72px] resize-y py-2"
            />
          </div>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => update("published", e.target.checked)}
            className="h-4 w-4 accent-[var(--apex)]"
          />
          <span className="font-medium">Published</span>
          <span className="text-muted">(visible on the public blog page)</span>
        </label>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Label>Content (Markdown)</Label>
          <span className="text-xs text-muted">Use the toolbar for formatting options</span>
        </div>
        <div className="mb-2 flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1.5">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.label}
                type="button"
                title={t.label}
                onClick={t.action}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-card hover:text-foreground"
              >
                <Icon size={15} />
              </button>
            );
          })}
        </div>

        {preview ? (
          <div className="min-h-[320px] rounded-xl border border-line bg-background p-4">
            {form.content.trim() ? (
              <MarkdownContent content={form.content} />
            ) : (
              <p className="text-sm text-muted">Nothing to preview yet.</p>
            )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={form.content}
            onChange={(e) => update("content", e.target.value)}
            placeholder={"Write your blog post here...\n\nUse **bold**, *italic*, headings, lists, links, images, quotes, and code."}
            rows={18}
            className="input min-h-[360px] resize-y font-mono text-sm leading-6"
          />
        )}
      </Card>
    </form>
  );
}
