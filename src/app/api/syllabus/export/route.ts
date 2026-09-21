import { verifySession } from "@/lib/auth";
import { loadSyllabus } from "@/lib/syllabus";
import type { ExportFormat } from "@/types/syllabus";

export const runtime = "nodejs";

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toMarkdown(
  tree: Awaited<ReturnType<typeof loadSyllabus>>,
  stats: { exportedAt: string },
): string {
  const lines: string[] = [];
  lines.push("# Apex Syllabus Coverage");
  lines.push("");
  lines.push(
    `**Coverage:** ${tree.stats.coverage}% · **Concepts:** ${tree.stats.conceptsCompleted}/${tree.stats.totalConcepts} · **Streak:** ${tree.stats.streakDays} days`,
  );
  lines.push("");
  lines.push(`_Exported ${stats.exportedAt}_`);
  for (const subject of tree.subjects) {
    lines.push("");
    lines.push(`## ${subject.name}${subject.classLevel ? ` (${subject.classLevel})` : ""}`);
    for (const chapter of subject.chapters) {
      lines.push("");
      lines.push(`### ${chapter.name}`);
      lines.push(
        `Coverage ${chapter.coverage}% · ${chapter.completedCount}/${chapter.conceptCount} concepts${chapter.revisionDue ? ` · ⚠ ${chapter.revisionDue} due revision` : ""}`,
      );
      for (const concept of chapter.concepts) {
        lines.push(
          `- [${concept.coverage}% · ${concept.status}] ${concept.name} — ${concept.difficulty}${concept.tags.length ? ` · #${concept.tags.join(" #")}` : ""}`,
        );
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

function toCsv(
  tree: Awaited<ReturnType<typeof loadSyllabus>>,
): string {
  const header = ["subject", "class", "chapter", "concept", "difficulty", "status", "coverage", "confidence", "tags", "last revised"].join(",");
  const rows = tree.subjects.flatMap((subject) =>
    subject.chapters.flatMap((chapter) =>
      chapter.concepts.map((concept) =>
        [
          subject.name,
          subject.classLevel ?? "",
          chapter.name,
          concept.name,
          concept.difficulty,
          concept.status,
          String(concept.coverage),
          String(concept.confidence),
          concept.tags.join(";"),
          concept.lastRevisedAt ?? "",
        ]
          .map(escapeCsv)
          .join(","),
      ),
    ),
  );
  return [header, ...rows].join("\n");
}

export async function GET(req: Request) {
  const userId = await verifySession();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "json") as ExportFormat;
  if (!["json", "markdown", "csv"].includes(format)) {
    return Response.json({ error: "Unsupported format" }, { status: 400 });
  }

  const tree = await loadSyllabus(userId);
  const stamp = new Date().toISOString();

  if (format === "json") {
    return new Response(JSON.stringify({ exportedAt: stamp, ...tree }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="apex-syllabus-${stamp.slice(0, 10)}.json"`,
      },
    });
  }

  if (format === "markdown") {
    return new Response(toMarkdown(tree, { exportedAt: stamp }), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="apex-syllabus-${stamp.slice(0, 10)}.md"`,
      },
    });
  }

  return new Response(toCsv(tree), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="apex-syllabus-${stamp.slice(0, 10)}.csv"`,
    },
  });
}