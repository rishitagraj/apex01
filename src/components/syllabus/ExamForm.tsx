"use client";

import { useMemo, useState } from "react";
import {
  X,
  Loader2,
  CalendarDays,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { SyllabusTree, SubjectVM, ChapterVM } from "@/types/syllabus";
import type { ExamType, ExamVM } from "@/types/exams";
import { EXAM_TYPES, EXAM_TYPE_LABEL } from "@/types/exams";

function setWith(set: Set<string>, id: string, on: boolean): Set<string> {
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

function without(set: Set<string>, ids: Iterable<string>): Set<string> {
  const next = new Set(set);
  for (const id of ids) next.delete(id);
  return next;
}

function withAll(set: Set<string>, ids: Iterable<string>): Set<string> {
  const next = new Set(set);
  for (const id of ids) next.add(id);
  return next;
}

function errorText(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    for (const value of Object.values(err as Record<string, unknown>)) {
      if (Array.isArray(value) && value.length > 0) return String(value[0]);
      if (typeof value === "string") return value;
    }
  }
  return "Something went wrong.";
}

export function ExamForm({
  tree,
  initial,
  onClose,
  onSaved,
}: {
  tree: SyllabusTree;
  initial?: ExamVM | null;
  onClose: () => void;
  onSaved: (exam: ExamVM) => void;
}) {
  const editing = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial ? initial.date.slice(0, 10) : "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [type, setType] = useState<ExamType>(initial?.type ?? "UNIT_TEST");
  const [classLevel, setClassLevel] = useState(initial?.classLevel ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [fullChapters, setFullChapters] = useState<Set<string>>(
    () => new Set(initial?.chapterIds ?? []),
  );
  const [partialConcepts, setPartialConcepts] = useState<Set<string>>(
    () => new Set(initial?.conceptIds ?? []),
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const chapterIsSelected = (ch: ChapterVM) =>
    fullChapters.has(ch.id) ||
    ch.concepts.some((c) => partialConcepts.has(c.id));

  const subjectIsSelected = (s: SubjectVM) =>
    s.chapters.some((ch) => chapterIsSelected(ch));

  function toggleChapter(ch: ChapterVM) {
    if (fullChapters.has(ch.id)) {
      setFullChapters((prev) => without(prev, [ch.id]));
      setPartialConcepts((prev) =>
        without(prev, ch.concepts.map((c) => c.id)),
      );
      return;
    }
    setFullChapters((prev) => withAll(prev, [ch.id]));
    setPartialConcepts((prev) => without(prev, ch.concepts.map((c) => c.id)));
  }

  function toggleConcept(ch: ChapterVM, conceptId: string) {
    if (fullChapters.has(ch.id)) {
      const rest = ch.concepts.filter((c) => c.id !== conceptId).map((c) => c.id);
      setFullChapters((prev) => without(prev, [ch.id]));
      setPartialConcepts((prev) => withAll(prev, rest));
      return;
    }
    const nextPartial = setWith(
      partialConcepts,
      conceptId,
      !partialConcepts.has(conceptId),
    );
    const allSelected = ch.concepts.every((c) => nextPartial.has(c.id));
    if (allSelected) {
      setPartialConcepts((prev) =>
        without(prev, ch.concepts.map((c) => c.id)),
      );
      setFullChapters((prev) => withAll(prev, [ch.id]));
    } else {
      setPartialConcepts(nextPartial);
    }
  }

  function toggleSubject(subject: SubjectVM) {
    const allChapterIds = subject.chapters.map((ch) => ch.id);
    const allConceptIds = subject.chapters.flatMap((ch) =>
      ch.concepts.map((c) => c.id),
    );
    if (subjectIsSelected(subject)) {
      setFullChapters((prev) => without(prev, allChapterIds));
      setPartialConcepts((prev) => without(prev, allConceptIds));
    } else {
      setFullChapters((prev) => withAll(prev, allChapterIds));
      setPartialConcepts((prev) => without(prev, allConceptIds));
    }
  }

  const selectedCount = useMemo(() => {
    let chapters = 0;
    let concepts = 0;
    for (const s of tree.subjects) {
      for (const ch of s.chapters) {
        if (fullChapters.has(ch.id)) {
          chapters += 1;
          concepts += ch.concepts.length;
        } else {
          concepts += ch.concepts.filter((c) => partialConcepts.has(c.id)).length;
        }
      }
    }
    return { chapters, concepts };
  }, [tree, fullChapters, partialConcepts]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Give the exam a name.");
    if (!date) return setError("Pick an exam date.");
    const chapterIds = [...fullChapters];
    const conceptIds = [...partialConcepts];
    if (chapterIds.length + conceptIds.length === 0) {
      return setError("Select at least one chapter or concept.");
    }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/exams/${initial!.id}` : "/api/exams", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          date,
          time: time || "",
          type,
          classLevel: classLevel.trim(),
          notes: notes.trim(),
          subjectIds: [],
          chapterIds,
          conceptIds,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errorText(data?.error) || `Request failed (${res.status})`);
        return;
      }
      onSaved(data.exam as ExamVM);
    } catch {
      setError("Could not save the exam. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-line bg-card sm:h-[86vh] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">
              {editing ? "Edit exam" : "New exam"}
            </h2>
            <p className="text-xs text-muted">
              Pick topics straight from your syllabus — nothing is duplicated.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_1.2fr]">
            {/* Metadata */}
            <div className="min-h-0 space-y-4 overflow-y-auto border-b border-line p-5 lg:border-b-0 lg:border-r">
              <div>
                <label className="label" htmlFor="exam-name">Exam name</label>
                <input
                  id="exam-name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Physics Midterm"
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="exam-date">Exam date</label>
                  <div className="relative">
                    <input
                      id="exam-date"
                      type="date"
                      className="input"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                    <CalendarDays
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                    />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="exam-time">Time (optional)</label>
                  <div className="relative">
                    <input
                      id="exam-time"
                      type="time"
                      className="input"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                    <Clock
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="exam-type">Exam type</label>
                  <select
                    id="exam-type"
                    className="input"
                    value={type}
                    onChange={(e) => setType(e.target.value as ExamType)}
                  >
                    {EXAM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {EXAM_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="exam-class">Class / level (optional)</label>
                  <input
                    id="exam-class"
                    className="input"
                    value={classLevel}
                    onChange={(e) => setClassLevel(e.target.value)}
                    placeholder="e.g. Class 12"
                    maxLength={60}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="exam-notes">Notes (optional)</label>
                <textarea
                  id="exam-notes"
                  className="input min-h-20 resize-y"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Syllabus hints, weightage, room…"
                  maxLength={2000}
                />
              </div>
            </div>

            {/* Syllabus picker */}
            <div className="flex min-h-0 flex-col">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Syllabus to include
                </span>
                <span className="text-[11px] text-muted">
                  {selectedCount.chapters} chapter(s) · {selectedCount.concepts} concept(s)
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {tree.subjects.length === 0 ? (
                  <p className="px-3 py-10 text-center text-sm text-muted">
                    Import a syllabus first, then come back to add exams.
                  </p>
                ) : (
                  tree.subjects.map((subject) => {
                    const subjectOn = subjectIsSelected(subject);
                    const subjectOpen = expanded[subject.id] !== false;
                    return (
                      <div key={subject.id} className="mb-1.5 rounded-xl border border-line">
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={subjectOn}
                            onChange={() => toggleSubject(subject)}
                            className="h-4 w-4 accent-[var(--apex)]"
                            aria-label={`Select all of ${subject.name}`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((prev) => ({
                                ...prev,
                                [subject.id]: prev[subject.id] === false,
                              }))
                            }
                            className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                          >
                            <span className="truncate text-sm font-semibold">
                              {subject.name}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-muted">
                              {subject.chapters.length} chapters
                              {subjectOpen ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )}
                            </span>
                          </button>
                        </div>

                        {subjectOpen ? (
                          <div className="space-y-1 border-t border-line px-2 py-2">
                            {subject.chapters.map((chapter) => {
                              const chapterFull = fullChapters.has(chapter.id);
                              const chapterPartial =
                                !chapterFull && chapterIsSelected(chapter);
                              const chapterOpen = !!expanded[chapter.id];
                              return (
                                <div key={chapter.id} className="rounded-lg">
                                  <div className="flex items-center gap-2 px-2 py-1.5">
                                    <input
                                      type="checkbox"
                                      ref={(el) => {
                                        if (el) el.indeterminate = chapterPartial;
                                      }}
                                      checked={chapterFull}
                                      onChange={() => toggleChapter(chapter)}
                                      className="h-4 w-4 accent-[var(--apex)]"
                                      aria-label={`Select chapter ${chapter.name}`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpanded((prev) => ({
                                          ...prev,
                                          [chapter.id]: !prev[chapter.id],
                                        }))
                                      }
                                      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                                    >
                                      <span className="truncate text-[13px]">
                                        {chapter.name}
                                      </span>
                                      <span className="flex items-center gap-1 text-[10px] text-muted">
                                        {chapter.conceptCount} concepts
                                        {chapter.concepts.length > 0 ? (
                                          chapterOpen ? (
                                            <ChevronDown size={12} />
                                          ) : (
                                            <ChevronRight size={12} />
                                          )
                                        ) : null}
                                      </span>
                                    </button>
                                  </div>
                                  {chapterOpen && chapter.concepts.length > 0 ? (
                                    <div className="ml-6 space-y-0.5 border-l border-line pl-3">
                                      {chapter.concepts.map((concept) => (
                                        <label
                                          key={concept.id}
                                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[12px] text-muted hover:text-foreground"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={
                                              chapterFull ||
                                              partialConcepts.has(concept.id)
                                            }
                                            onChange={() =>
                                              toggleConcept(chapter, concept.id)
                                            }
                                            className="h-3.5 w-3.5 accent-[var(--apex)]"
                                          />
                                          <span className="truncate">
                                            {concept.name}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {error ? (
            <p className="border-t border-line px-5 py-2 text-sm text-rose-400">{error}</p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" onClick={onClose} className="btn">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn bg-apex-gradient text-white"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {editing ? "Save changes" : "Create exam"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
