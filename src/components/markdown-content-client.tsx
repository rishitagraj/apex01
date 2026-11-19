"use client";

import React from "react";
import { markdownToHtml } from "@/lib/markdown";

export function MarkdownContent({ content, className = "" }: { content: string; className?: string }) {
  const html = React.useMemo(() => markdownToHtml(content || ""), [content]);
  return (
    <div
      className={`blog-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
