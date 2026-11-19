import { markdownToHtml } from "@/lib/markdown";

export function MarkdownContent({ content, className = "" }: { content: string; className?: string }) {
  const html = markdownToHtml(content || "");
  return (
    <div
      className={`blog-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
