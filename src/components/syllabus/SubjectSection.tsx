"use client";

import { useMemo, useState } from "react";
import { GraduationCap, Plus, Trash2, X, Check, Loader2 } from "lucide-react";
import type { ChapterVM, SubjectVM } from "@/types/syllabus";

const SUBJECT_COLORS = [
  "from-orange-500 to-rose-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-fuchsia-500 to-purple-500",
  "from-amber-500 to-orange-500",
  "from-cyan-500 to-blue-500",
  "from-lime-500 to-green-500",
  "from-pink-500 to-rose-500",
];

function subjectColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

function parseTopicLine(text: string): {
  name: string;
  concepts: string[];
} {
  const trimmed = text.trim();
  if (!trimmed) return { name: "", concepts: [] };
  const sep = trimmed.indexOf("::");
  if (sep === -1) return { name: trimmed, concepts: [] };
  const name = trimmed.slice(0, sep).trim();
  const concepts = trimmed
    .slice(sep + 2)
    .split(/[|,;]/)
    .map((c) => c.trim())
    .filter(Boolean);
  return { name, concepts };
}

export function SubjectSection({
  subject,
  chapters,
  expanded,
  onToggle,
  onAddTopic,
  onDeleteSubject,
  children,
}: {
  subject: SubjectVM;
  chapters: ChapterVM[];
  expanded: boolean;
  onToggle: () => void;
  onAddTopic: (subjectId: string, name: string, concepts: string[]) => void;
  onDeleteSubject: (subjectId: string) => void;
  children: React.ReactNode;
}) {
  const stats = useMemo(() => {
    const totalConcepts = chapters.reduce((s, c) => s + c.conceptCount, 0);
    const completed = chapters.reduce((s, c) => s + c.completedCount, 0);
    const coverage = totalConcepts
      ? Math.round(
          chapters.reduce(
            (s, c) => s + c.coverage * c.conceptCount,
            0,
          ) / totalConcepts,
        )
      : 0;
    return { totalConcepts, completed, coverage };
  }, [chapters]);

  const [adding, setAdding] = useState(false);
  const [topicText, setTopicText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitTopic = async () => {
    const { name, concepts } = parseTopicLine(topicText);
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/syllabus/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId: subject.id, name, concepts }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Add topic failed");
      onAddTopic(subject.id, name, concepts);
      setTopicText("");
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add topic failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    if (
      window.confirm(
        `Delete subject "${subject.name}"? This removes all its topics, concepts and progress.`,
      )
    ) {
      onDeleteSubject(subject.id);
    }
  };

  return (
    <section aria-label={`${subject.name} subject`} className="space-y-3">
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`subject-${subject.id}`}
          className="min-w-0 flex-1 rounded-2xl border border-line bg-surface/60 px-4 py-3 text-left transition hover:border-apex/30 hover:bg-surface"
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg shadow-black/30 transition-transform ${subjectColor(
                subject.id,
              )} ${expanded ? "rotate-180" : ""}`}
            >
              <GraduationCap size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate font-bold">{subject.name}</h3>
                {subject.classLevel ? (
                  <span className="chip border-line bg-black/20 text-[11px] text-muted">
                    Class {subject.classLevel}
                  </span>
                ) : null}
                {subject.examTags.map((t) => (
                  <span
                    key={t}
                    className="chip border-apex/25 bg-apex/10 text-[10px] text-apex"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="mt-0.5 text-[11px] text-muted">
                {chapters.length} chapters · {stats.completed}/{stats.totalConcepts} concepts mastered
              </p>
            </div>
            <div className="hidden w-32 shrink-0 sm:block">
              <div className="flex items-end justify-between text-[11px]">
                <span className="text-muted">Coverage</span>
                <span className="font-semibold tabular-nums">
                  {stats.coverage}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-apex-gradient transition-all duration-700"
                  style={{ width: `${stats.coverage}%` }}
                />
              </div>
            </div>
          </div>
        </button>

        <div className="flex shrink-0 flex-col justify-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setAdding((v) => !v);
              setError(null);
            }}
            aria-label={`Add topic to ${subject.name}`}
            aria-expanded={adding}
            title="Add topic"
            className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-muted transition hover:border-apex/40 hover:text-apex"
          >
            {adding ? <X size={15} /> : <Plus size={15} />}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            aria-label={`Delete subject ${subject.name}`}
            title="Delete subject"
            className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-muted transition hover:border-rose-500/40 hover:text-rose-300"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {adding ? (
        <div className="rounded-2xl border border-apex/25 bg-apex/5 p-3">
          <label className="mb-1.5 block text-[11px] text-muted">
            New topic — one line, concepts optional after{" "}
            <code className="rounded bg-black/30 px-1">::</code> (comma-separated)
          </label>
          <div className="flex gap-2">
            <input
              value={topicText}
              onChange={(e) => setTopicText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitTopic();
              }}
              autoFocus
              placeholder="e.g. Laws of Motion :: Newton, FBD, pulley"
              aria-label="New topic name in this subject"
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => void submitTopic()}
              disabled={busy || !parseTopicLine(topicText).name}
              aria-label="Save topic"
              className="btn"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
          </div>
          {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        </div>
      ) : null}

      {expanded ? (
        <div id={`subject-${subject.id}`} className="space-y-3">
          {chapters.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-xs text-muted">
              No topics yet — use the + button above to add one, or import a
              syllabus.
            </p>
          ) : (
            children
          )}
        </div>
      ) : null}
    </section>
  );
}