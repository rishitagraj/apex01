"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Check, PenLine } from "lucide-react";
import { DEFAULT_PARSE_OPTIONS, type RoadmapDraft } from "@/types/syllabus";

interface SubjectRow {
  name: string;
  chapters: string;
}

interface ParsedChapter {
  name: string;
  concepts: string[];
}

function parseChapters(text: string): ParsedChapter[] {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.indexOf("::");
      if (sep === -1) return { name: line, concepts: [] };
      const name = line.slice(0, sep).trim();
      const concepts = line
        .slice(sep + 2)
        .split(/[|,;]/)
        .map((c) => c.trim())
        .filter(Boolean);
      return { name, concepts };
    })
    .filter((ch) => ch.name.length > 0);
}

export function ManualSyllabusForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [course, setCourse] = useState("");
  const [rows, setRows] = useState<SubjectRow[]>([{ name: "", chapters: "" }]);
  const [acceptedPrompt, setAcceptedPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = rows.filter((r) => r.name.trim().length > 0);
  const canSubmit = visible.length > 0 && !busy;

  const updateRow = (i: number, patch: Partial<SubjectRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    if (!canSubmit) return;
    const subjects = visible.map((r) => ({
      name: r.name.trim(),
      chapters: parseChapters(r.chapters).map((ch) => ({
        name: ch.name,
        concepts: ch.concepts.map((name) => ({ name })),
      })),
    }));
    const roadmap: RoadmapDraft = {
      course: course.trim() || subjects[0].name,
      subjects,
      warnings: [],
    };

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/syllabus/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roadmap,
          course: roadmap.course,
          pdfName: null,
          fileKey: null,
          instructions: "Manual entry",
          options: { ...DEFAULT_PARSE_OPTIONS, keepPdf: false },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Manual import failed");
      onDone();
      router.refresh();
      router.push("/syllabus");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Manual import failed");
      setBusy(false);
    }
  };

  return (
    <div className="card rounded-3xl p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-apex/15 text-apex">
          <PenLine size={17} />
        </span>
        <div>
          <h2 className="font-semibold">Add syllabus manually</h2>
          <p className="text-xs text-muted">
            One subject per row. List chapters one per line; add concepts after{" "}
            <code className="rounded bg-black/30 px-1 text-[11px]">::</code>{" "}
            (separate with commas).
          </p>
        </div>
      </div>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-xs text-muted">Course name (optional)</span>
        <input
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          placeholder="e.g. CBSE Class 12 · JEE Main"
          className="w-full rounded-xl border border-line bg-black/20 px-3 py-2.5 text-sm outline-none transition placeholder:text-muted/60 focus:border-apex/40"
        />
      </label>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-2xl border border-line bg-black/20 p-3">
            <div className="flex items-center gap-2">
              <input
                value={row.name}
                onChange={(e) => updateRow(i, { name: e.target.value })}
                placeholder={`Subject ${i + 1} (e.g. Physics)`}
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium outline-none transition placeholder:text-muted/60 focus:border-apex/40"
              />
              <button
                onClick={() =>
                  setRows((prev) =>
                    prev.length === 1
                      ? prev
                      : prev.filter((_, idx) => idx !== i),
                  )
                }
                disabled={rows.length === 1}
                className="rounded-lg p-2 text-muted transition hover:text-rose-400 disabled:opacity-30"
                aria-label={`Remove ${row.name || `subject ${i + 1}`}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <textarea
              value={row.chapters}
              onChange={(e) => updateRow(i, { chapters: e.target.value })}
              spellCheck={false}
              rows={3}
              placeholder={"Chapters — one per line, e.g.\nKinematics\nLaws of Motion :: Newton, formula, pulley"}
              className="mt-2 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none transition placeholder:text-muted/60 focus:border-apex/40"
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => setRows((prev) => [...prev, { name: "", chapters: "" }])}
          className="btn"
        >
          <Plus size={15} className="mr-1.5 inline" /> Add subject
        </button>

        {visible.length > 0 ? (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={acceptedPrompt}
              onChange={(e) => setAcceptedPrompt(e.target.checked)}
              className="h-4 w-4 accent-[#ff7a1a]"
            />
            I&apos;ve double-checked my entries
          </label>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => void submit()}
          disabled={!canSubmit || (visible.length > 0 && !acceptedPrompt)}
          className="btn bg-apex-gradient px-5 text-white shadow-lg shadow-apex/25 hover:opacity-90 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={15} className="mr-1.5 inline animate-spin" />
          ) : (
            <Check size={15} className="mr-1.5 inline" />
          )}
          Import manually
        </button>
        <span className="text-[11px] text-muted">
          No PDF needed — appends to your coverage map.
        </span>
      </div>
    </div>
  );
}