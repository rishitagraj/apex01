function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeUrl(url: string) {
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:|\/)/i.test(trimmed)) return trimmed;
  return "#";
}

function renderInline(text: string): string {
  let s = escapeHtml(text);
  const code: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    const i = code.push(`<code class="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.9em] text-apex">${c}</code>`) - 1;
    return `%%CODE${i}%%`;
  });
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const src = sanitizeUrl(url);
    return `<img src="${src}" alt="${alt}" class="my-4 max-h-[480px] w-auto max-w-full rounded-xl border border-line" loading="lazy" />`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const href = sanitizeUrl(url);
    const external = /^https?:\/\//i.test(href);
    return `<a href="${href}" class="text-apex underline underline-offset-2 hover:opacity-90"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_\n]+)_/g, "<em>$1</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  s = s.replace(/%%CODE(\d+)%%/g, (_, i) => code[Number(i)] ?? "");
  return s;
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const flushParagraph = (buf: string[]) => {
    if (!buf.length) return;
    const text = buf.join(" ").trim();
    if (text) out.push(`<p class="my-3 leading-7 text-foreground/90">${renderInline(text)}</p>`);
    buf.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      if (i < lines.length) i++;
      const lang = fence[1] ? ` data-lang="${escapeHtml(fence[1])}"` : "";
      out.push(
        `<pre class="my-4 overflow-x-auto rounded-xl border border-line bg-[#0b0f1a] p-4 text-sm"${lang}><code class="font-mono text-slate-200">${codeLines.join("\n")}</code></pre>`,
      );
      continue;
    }

    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const sizes: Record<number, string> = {
        1: "text-3xl font-bold mt-8 mb-3",
        2: "text-2xl font-semibold mt-7 mb-3",
        3: "text-xl font-semibold mt-6 mb-2",
        4: "text-lg font-semibold mt-5 mb-2",
        5: "text-base font-semibold mt-4 mb-2",
        6: "text-sm font-semibold mt-4 mb-2",
      };
      out.push(`<h${level} class="${sizes[level]} tracking-tight">${renderInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      out.push('<hr class="my-8 border-line" />');
      i++;
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      const q: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^>\s?(.*)$/);
        if (!m) break;
        q.push(m[1]);
        i++;
      }
      out.push(
        `<blockquote class="my-4 border-l-4 border-apex/60 pl-4 italic text-muted">${q.map((l) => renderInline(l)).join("<br/>")}</blockquote>`,
      );
      continue;
    }

    const ul = line.match(/^[-*+]\s+(.*)$/);
    if (ul) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^[-*+]\s+(.*)$/);
        if (!m) break;
        items.push(`<li class="my-1">${renderInline(m[1])}</li>`);
        i++;
      }
      out.push(`<ul class="my-3 list-disc space-y-1 pl-6 text-foreground/90">${items.join("")}</ul>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\d+\.\s+(.*)$/);
        if (!m) break;
        items.push(`<li class="my-1">${renderInline(m[1])}</li>`);
        i++;
      }
      out.push(`<ol class="my-3 list-decimal space-y-1 pl-6 text-foreground/90">${items.join("")}</ol>`);
      continue;
    }

    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^[-*+]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i].trim())
    ) {
      buf.push(lines[i]);
      i++;
    }
    flushParagraph(buf);
  }

  return out.join("\n");
}
