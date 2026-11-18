"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Clock,
  CalendarDays,
  GraduationCap,
  Wand2,
  Plus,
  Loader2,
  ChevronDown,
  ChevronRight,
  TriangleAlert,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import { ProgressRing } from "@/components/syllabus/ProgressRing";
import { ConceptCard } from "@/components/syllabus/ConceptCard";
import { ConceptDrawer } from "@/components/syllabus/ConceptDrawer";
import { ExamPlanDialog } from "@/components/syllabus/ExamPlanDialog";
import { STATUS_CHIP } from "@/components/syllabus/colors";
import { formatMinutes } from "@/components/ui";
import type { ConceptVM } from "@/types/syllabus";
import type {
  ExamAttemptVM,
  ExamDetailVM,
  ReadinessLevel,
} from "@/types/exams";

export type SaveFn = (
  action: string,
  conceptId: string,
  extra?: Record<string, unknown>,
) => Promise<{ ok: boolean; [k: string]: unknown }>;

const READINESS: Record<ReadinessLevel, { label: string; className: string }> = {
  insufficient: { label: "Not enough data yet", className: "text-muted" },
  low: { label: "Low readiness", className: "text-rose-400" },
  medium: { label: "Moderate readiness", className: "text-amber-400" },
  high: { label: "Strong readiness", className: "text-emerald-400" },
};

function fmtDate(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function countdown(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `in ${days} days`;
  if (days === -1) return "Yesterday";
  return `${-days} days ago`;
}

export function ExamDetail({
  exam,
  save,
  onBack,
  onEdit,
  onDelete,
  onChanged,
}: {
  exam: ExamDetailVM;
  save: SaveFn;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const [openConcept, setOpenConcept] = useState<ConceptVM | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [showAttempt, setShowAttempt] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const p = exam.progress;
  const readiness = READINESS[p.readinessLevel];

  async function quickRevise(concept: ConceptVM) {
    await save("revise", concept.id, { kind: "MANUAL" });
    onChanged();
  }
  async function toggleFlag(concept: ConceptVM) {
    await save("toggleRevisionFlag", concept.id, {
      needsRevision: !concept.needsRevision,
    });
    onChanged();
  }

  const chaptersBySubject = new Map<
    string,
    { subjectName: string; chapters: ExamDetailVM["chapterProgress"] }
  >();
  for (const ch of exam.chapterProgress) {
    const entry = chaptersBySubject.get(ch.subjectId) ?? {
      subjectName: ch.subjectName,
      chapters: [],
    };
    entry.chapters.push(ch);
    chaptersBySubject.set(ch.subjectId, entry);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="btn"
          aria-label="Back to exams"
        >
          <ArrowLeft size={15} className="mr-1.5 inline" /> Exams
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="btn">
            <Pencil size={14} className="mr-1.5 inline" /> Edit
          </button>
          <button
            onClick={onDelete}
            className="btn border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 size={14} className="mr-1.5 inline" /> Delete
          </button>
        </div>
      </div>

      <div className="card rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold tracking-tight">{exam.name}</h2>
              <span className="chip border-apex/30 bg-apex/10 text-[11px] font-medium text-apex">
                {exam.type.replace("_", " ")}
              </span>
              {exam.classLevel ? (
                <span className="chip border-line bg-surface text-[11px] text-muted">
                  {exam.classLevel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={12} /> {fmtDate(exam.date)}
              </span>
              {exam.time ? (
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} /> {exam.time}
                </span>
              ) : null}
              <span
                className={
                  exam.status === "completed"
                    ? "text-emerald-400"
                    : exam.status === "past"
                      ? "text-muted"
                      : exam.daysUntil <= 7
                        ? "font-semibold text-amber-300"
                        : "text-muted"
                }
              >
                {exam.status === "completed"
                  ? "Result recorded"
                  : exam.status === "past"
                    ? "Date passed — no result recorded"
                    : countdown(exam.daysUntil)}
              </span>
            </p>
            {exam.subjects.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {exam.subjects.map((s) => (
                  <span
                    key={s.id}
                    className="chip border-line bg-surface text-[11px] text-muted"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-center">
              <ProgressRing value={p.coverage} size={78} stroke={7} label="Coverage" />
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">
                Coverage
              </p>
            </div>
            <div className="text-center">
              {p.readiness != null ? (
                <ProgressRing
                  value={p.readiness}
                  size={78}
                  stroke={7}
                  label="Readiness"
                />
              ) : (
                <div className="flex h-[78px] w-[78px] items-center justify-center rounded-full border-4 border-line text-sm text-muted">
                  —
                </div>
              )}
              <p className={`mt-1 text-[10px] uppercase tracking-wide ${readiness.className}`}>
                Readiness
              </p>
            </div>
          </div>
        </div>

        {exam.notes ? (
          <p className="mt-3 rounded-xl border border-line bg-black/20 px-3 py-2 text-xs text-muted">
            {exam.notes}
          </p>
        ) : null}

        <p className="mt-3 text-[11px] text-muted">{readiness.label}
          {p.readiness != null
            ? " — blends concept mastery, revision health and past results."
            : " — use the syllabus to start mastering these concepts."}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Concepts" value={`${p.completedCount}/${p.conceptCount}`} hint="covered" />
          <Stat
            label="Needs revision"
            value={String(p.needsRevisionCount)}
            hint="flagged / due"
            tone={p.needsRevisionCount > 0 ? "warn" : undefined}
          />
          <Stat
            label="Weak"
            value={String(p.weakCount)}
            hint="low confidence"
            tone={p.weakCount > 0 ? "bad" : undefined}
          />
          <Stat
            label="Left to study"
            value={formatMinutes(p.remainingMinutes)}
            hint="estimated"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setShowPlan(true)}
            className="btn bg-apex-gradient text-white"
          >
            <Wand2 size={15} className="mr-1.5 inline" /> Generate prep plan
          </button>
          <button onClick={() => setShowAttempt(true)} className="btn">
            <Plus size={15} className="mr-1.5 inline" /> Record result
          </button>
        </div>
      </div>

      {(exam.focusConcepts.length > 0 || exam.untestedConcepts.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {exam.focusConcepts.length > 0 ? (
            <FocusList
              title="Needs revision / weak"
              icon={<TriangleAlert size={14} className="text-amber-400" />}
              concepts={exam.focusConcepts}
              onOpen={setOpenConcept}
            />
          ) : null}
          {exam.untestedConcepts.length > 0 ? (
            <FocusList
              title="Not yet demonstrated"
              icon={<ClipboardList size={14} className="text-sky-400" />}
              concepts={exam.untestedConcepts}
              onOpen={setOpenConcept}
            />
          ) : null}
        </div>
      )}

      <AttemptsCard
        attempts={exam.attempts}
        onRecord={() => setShowAttempt(true)}
      />

      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <GraduationCap size={16} className="text-apex" /> Chapter-wise progress
        </h3>
        {exam.chapterProgress.length === 0 ? (
          <p className="card rounded-2xl p-6 text-center text-sm text-muted">
            No chapters selected for this exam yet.
          </p>
        ) : (
          [...chaptersBySubject.entries()].map(([subjectId, group]) => (
            <div key={subjectId} className="card rounded-2xl p-4">
              <p className="mb-3 text-sm font-semibold">{group.subjectName}</p>
              <div className="space-y-2">
                {group.chapters.map((ch) => {
                  const open = !!expanded[ch.id];
                  return (
                    <div key={ch.id} className="rounded-xl border border-line">
                      <button
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [ch.id]: !prev[ch.id] }))
                        }
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                      >
                        {open ? (
                          <ChevronDown size={15} className="shrink-0 text-muted" />
                        ) : (
                          <ChevronRight size={15} className="shrink-0 text-muted" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                          {ch.name}
                          {ch.included === "partial" ? (
                            <span className="ml-2 chip border-line bg-surface px-1.5 py-0 text-[10px] text-muted">
                              selected concepts
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted tabular-nums">
                          {ch.completedCount}/{ch.conceptCount}
                        </span>
                        <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-line sm:block">
                          <div
                            className="h-full rounded-full bg-apex-gradient"
                            style={{ width: `${ch.coverage}%` }}
                          />
                        </div>
                        <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums text-muted">
                          {ch.coverage}%
                        </span>
                      </button>
                      {open ? (
                        <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2">
                          {ch.concepts.map((concept) => (
                            <ConceptCard
                              key={concept.id}
                              concept={concept}
                              onOpen={() => setOpenConcept(concept)}
                              onRevise={() => void quickRevise(concept)}
                              onFlag={() => void toggleFlag(concept)}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {openConcept ? (
        <ConceptDrawer
          key={openConcept.id}
          concept={openConcept}
          onClose={() => {
            setOpenConcept(null);
            onChanged();
          }}
          save={save}
        />
      ) : null}

      {showPlan ? (
        <ExamPlanDialog
          examId={exam.id}
          examName={exam.name}
          onClose={() => setShowPlan(false)}
          onApplied={() => {}}
        />
      ) : null}

      {showAttempt ? (
        <AttemptForm
          examId={exam.id}
          subjects={exam.subjectProgress.map((s) => ({ id: s.id, name: s.name }))}
          onClose={() => setShowAttempt(false)}
          onSaved={() => {
            setShowAttempt(false);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "warn" | "bad";
}) {
  return (
    <div className="rounded-xl border border-line bg-black/20 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`text-lg font-bold tabular-nums ${
          tone === "bad"
            ? "text-purple-300"
            : tone === "warn"
              ? "text-amber-300"
              : ""
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted">{hint}</p>
    </div>
  );
}

function FocusList({
  title,
  icon,
  concepts,
  onOpen,
}: {
  title: string;
  icon: React.ReactNode;
  concepts: ConceptVM[];
  onOpen: (c: ConceptVM) => void;
}) {
  return (
    <div className="card rounded-2xl p-4">
      <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold">
        {icon} {title}
        <span className="text-muted">({concepts.length})</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {concepts.slice(0, 24).map((c) => (
          <button
            key={c.id}
            onClick={() => onOpen(c)}
            className={`chip text-[11px] transition hover:brightness-125 ${STATUS_CHIP[c.status]}`}
          >
            {c.name}
            <span className="ml-1.5 text-muted tabular-nums">{c.coverage}%</span>
          </button>
        ))}
        {concepts.length > 24 ? (
          <span className="chip border-line bg-surface text-[11px] text-muted">
            +{concepts.length - 24} more
          </span>
        ) : null}
      </div>
    </div>
  );
}

function AttemptsCard({
  attempts,
  onRecord,
}: {
  attempts: ExamAttemptVM[];
  onRecord: () => void;
}) {
  return (
    <div className="card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CheckCircle2 size={15} className="text-emerald-400" /> Results
        </p>
        <button onClick={onRecord} className="chip border-apex/30 bg-apex/10 text-[11px] font-medium text-apex">
          <Plus size={11} className="mr-1 inline" /> Record result
        </button>
      </div>
      {attempts.length === 0 ? (
        <p className="text-xs text-muted">
          No results recorded yet. After the exam, log your marks to track readiness.
        </p>
      ) : (
        <div className="space-y-2">
          {attempts.map((a) => (
            <div key={a.id} className="rounded-xl border border-line bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted">{fmtDate(a.attemptDate)}</span>
                {a.marks != null && a.maxMarks != null ? (
                  <span className="text-sm font-bold tabular-nums">
                    {a.marks}/{a.maxMarks}
                    {a.percentage != null ? (
                      <span className="ml-1.5 text-xs font-medium text-muted">
                        ({a.percentage}%)
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </div>
              {a.subjectMarks.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {a.subjectMarks.map((s, i) => (
                    <span
                      key={`${s.name}-${i}`}
                      className="chip border-line bg-surface text-[10px] text-muted"
                    >
                      {s.name}: {s.marks ?? "—"}
                      {s.maxMarks != null ? `/${s.maxMarks}` : ""}
                    </span>
                  ))}
                </div>
              ) : null}
              {a.weakTopics ? (
                <p className="mt-1.5 text-[11px] text-amber-300">
                  Weak: {a.weakTopics}
                </p>
              ) : null}
              {a.mistakes ? (
                <p className="mt-1 text-[11px] text-muted">Mistakes: {a.mistakes}</p>
              ) : null}
              {a.reflections ? (
                <p className="mt-1 text-[11px] text-muted">{a.reflections}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttemptForm({
  examId,
  subjects,
  onClose,
  onSaved,
}: {
  examId: string;
  subjects: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [attemptDate, setAttemptDate] = useState(today);
  const [marks, setMarks] = useState("");
  const [maxMarks, setMaxMarks] = useState("");
  const [weakTopics, setWeakTopics] = useState("");
  const [mistakes, setMistakes] = useState("");
  const [reflections, setReflections] = useState("");
  const [subjectMarks, setSubjectMarks] = useState<Record<string, { marks: string; max: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setSubjectMark(id: string, field: "marks" | "max", value: string) {
    setSubjectMarks((prev) => ({
      ...prev,
      [id]: { ...{ marks: "", max: "" }, ...prev[id], [field]: value },
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!attemptDate) return setError("Pick the attempt date.");
    setSaving(true);
    try {
      const res = await fetch(`/api/exams/${examId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptDate,
          marks: marks === "" ? null : Number(marks),
          maxMarks: maxMarks === "" ? null : Number(maxMarks),
          subjectMarks: subjects.map((s) => ({
            subjectId: s.id,
            name: s.name,
            marks: subjectMarks[s.id]?.marks === "" || !subjectMarks[s.id]?.marks
              ? null
              : Number(subjectMarks[s.id].marks),
            maxMarks: subjectMarks[s.id]?.max === "" || !subjectMarks[s.id]?.max
              ? null
              : Number(subjectMarks[s.id].max),
          })),
          weakTopics: weakTopics.trim(),
          mistakes: mistakes.trim(),
          reflections: reflections.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Could not save this result.",
        );
        return;
      }
      onSaved();
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-card sm:max-h-[86vh] sm:rounded-3xl">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold">Record result</h2>
          <p className="text-xs text-muted">
            Log how it went so weak topics flow into your revision.
          </p>
        </div>
        <form onSubmit={submit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <label className="label" htmlFor="attempt-date">Date</label>
            <input
              id="attempt-date"
              type="date"
              className="input"
              value={attemptDate}
              onChange={(e) => setAttemptDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="attempt-marks">Marks scored</label>
              <input
                id="attempt-marks"
                type="number"
                min={0}
                step="1"
                className="input"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div>
              <label className="label" htmlFor="attempt-max">Out of</label>
              <input
                id="attempt-max"
                type="number"
                min={0}
                step="1"
                className="input"
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>

          {subjects.length > 0 ? (
            <div>
              <p className="label">Subject-wise marks (optional)</p>
              <div className="space-y-2">
                {subjects.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px]">{s.name}</span>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      className="input w-20"
                      value={subjectMarks[s.id]?.marks ?? ""}
                      onChange={(e) => setSubjectMark(s.id, "marks", e.target.value)}
                      placeholder="—"
                      aria-label={`${s.name} marks`}
                    />
                    <span className="text-muted">/</span>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      className="input w-20"
                      value={subjectMarks[s.id]?.max ?? ""}
                      onChange={(e) => setSubjectMark(s.id, "max", e.target.value)}
                      placeholder="—"
                      aria-label={`${s.name} out of`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="attempt-weak">Weak topics</label>
            <textarea
              id="attempt-weak"
              className="input min-h-16 resize-y"
              value={weakTopics}
              onChange={(e) => setWeakTopics(e.target.value)}
              placeholder="Topics that felt shaky…"
              maxLength={2000}
            />
          </div>
          <div>
            <label className="label" htmlFor="attempt-mistakes">Mistakes</label>
            <textarea
              id="attempt-mistakes"
              className="input min-h-16 resize-y"
              value={mistakes}
              onChange={(e) => setMistakes(e.target.value)}
              placeholder="Silly errors, time issues…"
              maxLength={2000}
            />
          </div>
          <div>
            <label className="label" htmlFor="attempt-reflections">Reflections</label>
            <textarea
              id="attempt-reflections"
              className="input min-h-16 resize-y"
              value={reflections}
              onChange={(e) => setReflections(e.target.value)}
              placeholder="What will you do differently next time?"
              maxLength={2000}
            />
          </div>

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn bg-apex-gradient text-white"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              Save result
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
