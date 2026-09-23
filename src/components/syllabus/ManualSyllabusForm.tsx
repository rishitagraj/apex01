"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Check, PenLine, FolderPlus } from "lucide-react";
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

type Mode = "subjects" | "topics";

export function ManualSyllabusForm({
  onDone,
  subjects,
  initialMode = "subjects",
  initialSubjectId,
}: {
  onDone: () => void;
  subjects: { id: string; name: string }[];
  initialMode?: Mode;
  initialSubjectId?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [course, setCourse] = useState("");
  const [rows, setRows] = useState<SubjectRow[]>([{ name: "", chapters: "" }]);
  const [acceptedPrompt, setAcceptedPrompt] = useState(false);
  const [subjectId, setSubjectId] = useState(
    initialSubjectId ?? subjects[0]?.id ?? "",
  );
  const [topicsText, setTopicsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = rows.filter((r) => r.name.trim().length > 0);
  const parsedTopics = parseChapters(topicsText);
  const canSubmitSubjects =
    visible.length > 0 && !busy && acceptedPrompt;
  const canSubmitTopics =
    !busy && subjectId.length > 0 && parsedTopics.length > 0;

  const updateRow = (i: number, patch: Partial<SubjectRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submitSubjects = async () => {
    if (!canSubmitSubjects) return;
    const subjectsPayload = visible.map((r) => ({
      name: r.name.trim(),
      chapters: parseChapters(r.chapters).map((ch) => ({
        name: ch.name,
        concepts: ch.concepts.map((name) => ({ name })),
      })),
    }));
    const roadmap: RoadmapDraft = {
      course: course.trim() || subjectsPayload[0].name,
      subjects: subjectsPayload,
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Manual import failed");
      setBusy(false);
    }
  };

  const submitTopics = async () => {
    if (!canSubmitTopics) return;
    const chapters = parsedTopics.map((ch) => ({
      name: ch.name,
      concepts: ch.concepts,
    }));

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/syllabus/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, chapters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Add topics failed");
      setTopicsText("");
      onDone();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add topics failed");
      setBusy(false);
    }
  };

  return (
    <div className="card rounded-3xl p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-apex/15 text-apex">
          <PenLine size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Add syllabus manually</h2>
          <p className="text-xs text-muted">
            No PDF needed — appends to your coverage map.
          </p>
        </div>
        <div className="flex shrink-0 gap-1 rounded-xl border border-line bg-surface p-1">
          <button
            type="button"
            onClick={() => setMode("subjects")}
            aria-pressed={mode === "subjects"}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              mode === "subjects"
                ? "bg-apex-gradient text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            New subjects
          </button>
          <button
            type="button"
            onClick={() => setMode("topics")}
            aria-pressed={mode === "topics"}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              mode === "topics"
                ? "bg-apex-gradient text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            <FolderPlus size={13} /> Add to subject
          </button>
        </div>
      </div>

      {mode === "subjects" ? (
        <>
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
                    type="button"
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
              type="button"
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
              type="button"
              onClick={() => void submitSubjects()}
              disabled={!canSubmitSubjects}
              className="btn bg-apex-gradient px-5 text-white shadow-lg shadow-apex/25 hover:opacity-90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={15} className="mr-1.5 inline animate-spin" />
              ) : (
                <Check size={15} className="mr-1.5 inline" />
              )}
              Import manually
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs text-muted">Subject</span>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-apex/40"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="mb-2 block">
            <span className="mb-1.5 block text-xs text-muted">
              Topics — one per line; add concepts after{" "}
              <code className="rounded bg-black/30 px-1 text-[11px]">::</code>{" "}
              (separate with commas)
            </span>
            <textarea
              value={topicsText}
              onChange={(e) => setTopicsText(e.target.value)}
              spellCheck={false}
              rows={5}
              placeholder={"Laws of Motion :: Newton, FBD, pulley\nFriction :: static, kinetic"}
              className="w-full resize-y rounded-xl border border-line bg-black/20 px-3 py-2.5 text-sm outline-none transition placeholder:text-muted/60 focus:border-apex/40"
            />
          </label>

          {error ? <p className="mt-1 text-sm text-rose-300">{error}</p> : null}

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void submitTopics()}
              disabled={!canSubmitTopics}
              className="btn bg-apex-gradient px-5 text-white shadow-lg shadow-apex/25 hover:opacity-90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={15} className="mr-1.5 inline animate-spin" />
              ) : (
                <FolderPlus size={15} className="mr-1.5 inline" />
              )}
              {parsedTopics.length > 0
                ? `Add ${parsedTopics.length} topic${parsedTopics.length === 1 ? "" : "s"}`
                : "Add topics"}
            </button>
            {parsedTopics.length > 0 ? (
              <span className="text-[11px] text-muted">
                {parsedTopics.length} recognized
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}