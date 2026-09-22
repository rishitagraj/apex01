"use client";

import { useMemo } from "react";
import { GraduationCap } from "lucide-react";
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

export function SubjectSection({
  subject,
  chapters,
  expanded,
  onToggle,
  children,
}: {
  subject: SubjectVM;
  chapters: ChapterVM[];
  expanded: boolean;
  onToggle: () => void;
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

  return (
    <section aria-label={`${subject.name} subjects`} className="space-y-3">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`subject-${subject.id}`}
        className="w-full rounded-2xl border border-line bg-surface/60 px-4 py-3 text-left transition hover:border-apex/30 hover:bg-surface"
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

      {expanded ? (
        <div id={`subject-${subject.id}`} className="space-y-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}