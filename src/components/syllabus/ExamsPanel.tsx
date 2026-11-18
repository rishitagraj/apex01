"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  CalendarDays,
  Clock,
  GraduationCap,
  ChevronRight,
  Loader2,
  TrendingUp,
  TriangleAlert,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import { ExamForm } from "@/components/syllabus/ExamForm";
import { ExamDetail, type SaveFn } from "@/components/syllabus/ExamDetail";
import { formatMinutes } from "@/components/ui";
import type { SyllabusTree } from "@/types/syllabus";
import { EXAM_TYPE_LABEL, type ExamDetailVM, type ExamVM } from "@/types/exams";

function fmtDate(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function countdown(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `in ${days} days`;
  if (days === -1) return "Yesterday";
  return `${-days} days ago`;
}

function statusChip(exam: ExamVM): { label: string; className: string } {
  if (exam.status === "completed")
    return { label: "Result recorded", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
  if (exam.status === "past")
    return { label: "Past", className: "border-line bg-surface text-muted" };
  if (exam.daysUntil <= 3)
    return { label: countdown(exam.daysUntil), className: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300" };
  if (exam.daysUntil <= 7)
    return { label: countdown(exam.daysUntil), className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" };
  return { label: countdown(exam.daysUntil), className: "border-apex/30 bg-apex/10 text-apex" };
}

function readinessDetail(value: number | null, level: string): string {
  if (value == null) return "No practice evidence yet";
  return `${level.charAt(0).toUpperCase()}${level.slice(1)} readiness`;
}

export function ExamsPanel({
  tree,
  save,
  refresh,
}: {
  tree: SyllabusTree;
  save: SaveFn;
  refresh: () => void | Promise<void>;
}) {
  const [exams, setExams] = useState<ExamVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExamDetailVM | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExamVM | null>(null);

  const loadExams = useCallback(async () => {
    try {
      const res = await fetch("/api/exams", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { exams: ExamVM[] };
      setExams(data.exams);
      setListError(null);
    } catch {
      setListError("Could not load your exams.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/exams", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((data: { exams: ExamVM[] }) => {
        if (cancelled) return;
        setExams(data.exams);
        setListError(null);
      })
      .catch(() => {
        if (!cancelled) setListError("Could not load your exams.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openExam = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/exams/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { exam: ExamDetailVM };
      setDetail(data.exam);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshDetail = useCallback(async () => {
    if (!detail) return;
    await Promise.all([loadExams(), refresh()]);
    try {
      const res = await fetch(`/api/exams/${detail.id}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { exam: ExamDetailVM };
        setDetail(data.exam);
      }
    } catch {
      /* keep current detail */
    }
  }, [detail, loadExams, refresh]);

  const handleDelete = useCallback(async () => {
    if (!detail) return;
    if (!window.confirm(`Delete "${detail.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/exams/${detail.id}`, { method: "DELETE" });
    if (!res.ok) {
      window.alert("Could not delete the exam.");
      return;
    }
    setDetail(null);
    await loadExams();
  }, [detail, loadExams]);

  const upcoming = useMemo(
    () => exams.filter((e) => e.status === "upcoming"),
    [exams],
  );
  const completed = useMemo(
    () =>
      exams
        .filter((e) => e.status === "completed")
        .sort((a, b) => b.date.localeCompare(a.date)),
    [exams],
  );
  const past = useMemo(
    () =>
      exams
        .filter((e) => e.status === "past")
        .sort((a, b) => b.date.localeCompare(a.date)),
    [exams],
  );

  const nextExam = upcoming[0] ?? null;
  const needsRevisionTotal = upcoming.reduce(
    (n, e) => n + e.progress.needsRevisionCount,
    0,
  );
  const untestedTotal = upcoming.reduce((n, e) => n + e.progress.untestedCount, 0);

  if (detailLoading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" /> Loading exam…
      </div>
    );
  }

  if (detail) {
    return (
      <>
        <ExamDetail
          exam={detail}
          save={save}
          onBack={() => {
            setDetail(null);
            void loadExams();
          }}
          onEdit={() => {
            setEditing(detail);
            setShowForm(true);
          }}
          onDelete={() => void handleDelete()}
          onChanged={() => void refreshDetail()}
        />
        {showForm ? (
          <ExamForm
            tree={tree}
            initial={editing}
            onClose={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSaved={async (saved) => {
              setShowForm(false);
              setEditing(null);
              await loadExams();
              await openExam(saved.id);
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Exams</h2>
          <p className="text-xs text-muted">
            Track upcoming exams, linked syllabus progress and past results.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn btn-primary"
        >
          <Plus size={15} className="mr-1.5 inline" /> New exam
        </button>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading exams">
          <span className="sr-only">Loading exams…</span>
          <div className="skeleton h-36 rounded-3xl" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
          <div className="skeleton h-16 rounded-2xl" />
          <div className="skeleton h-16 rounded-2xl" />
        </div>
      ) : listError ? (
        <p className="card rounded-2xl p-6 text-center text-sm text-muted">{listError}</p>
      ) : exams.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 rounded-3xl px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-apex-gradient text-white shadow-lg shadow-apex/25">
            <CalendarDays size={26} />
          </span>
          <div>
            <h3 className="text-base font-bold">No exams yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Add an exam and link the chapters or concepts from your syllabus to
              track exactly how ready you are.
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="btn btn-primary"
          >
            <Plus size={15} className="mr-1.5 inline" /> Add your first exam
          </button>
        </div>
      ) : (
        <>
          {nextExam ? (
            <div className="card relative overflow-hidden rounded-3xl p-5">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-apex/10 blur-3xl"
              />
              <div className="relative">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                    <TrendingUp size={13} className="text-apex" /> Next exam
                  </p>
                  <span
                    className={`chip text-[11px] font-medium ${
                      statusChip(nextExam).className
                    }`}
                  >
                    {statusChip(nextExam).label}
                  </span>
                </div>

                <button
                  onClick={() => void openExam(nextExam.id)}
                  className="group mt-3 w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold transition-colors group-hover:text-apex">
                        {nextExam.name}
                      </h3>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={12} /> {fmtDate(nextExam.date)}
                        </span>
                        {nextExam.time ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} /> {nextExam.time}
                          </span>
                        ) : null}
                        <span className="chip border-line bg-surface px-1.5 py-0 text-[10px] text-muted">
                          {EXAM_TYPE_LABEL[nextExam.type]}
                        </span>
                      </p>
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-muted transition group-hover:border-apex/40 group-hover:translate-x-0.5 group-hover:text-apex">
                      <ChevronRight size={16} />
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ProgressStat
                      label="Syllabus coverage"
                      value={nextExam.progress.coverage}
                      detail={`${nextExam.progress.completedCount}/${nextExam.progress.conceptCount} concepts covered`}
                      tone="apex"
                    />
                    <ProgressStat
                      label="Readiness"
                      value={nextExam.progress.readiness}
                      detail={readinessDetail(
                        nextExam.progress.readiness,
                        nextExam.progress.readinessLevel,
                      )}
                      tone="violet"
                    />
                  </div>

                  {nextExam.progress.remainingMinutes > 0 ? (
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
                      <TrendingUp size={12} className="text-apex" />≈{" "}
                      {formatMinutes(nextExam.progress.remainingMinutes)} of
                      study left
                    </p>
                  ) : null}
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat
              icon={<CalendarDays size={14} />}
              label="Upcoming"
              value={String(upcoming.length)}
            />
            <MiniStat
              icon={<CheckCircle2 size={14} />}
              label="With results"
              value={String(completed.length)}
            />
            <MiniStat
              icon={<TriangleAlert size={14} />}
              label="To revise"
              value={String(needsRevisionTotal)}
              hint="across upcoming"
            />
            <MiniStat
              icon={<ClipboardList size={14} />}
              label="Not demonstrated"
              value={String(untestedTotal)}
              hint="across upcoming"
            />
          </div>

          <Section title="Upcoming" exams={upcoming} onOpen={openExam} empty="No upcoming exams." />
          <Section
            title="Completed"
            exams={completed}
            onOpen={openExam}
            empty="No results recorded yet."
          />
          {past.length > 0 ? (
            <Section title="Past" exams={past} onOpen={openExam} empty="" muted />
          ) : null}
        </>
      )}

      {showForm ? (
        <ExamForm
          tree={tree}
          initial={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={async (saved) => {
            setShowForm(false);
            setEditing(null);
            await loadExams();
            await openExam(saved.id);
          }}
        />
      ) : null}
    </div>
  );
}

function ProgressStat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | null;
  detail: string;
  tone: "apex" | "violet";
}) {
  const gradient =
    tone === "violet"
      ? "from-indigo-400 to-violet-500"
      : "from-apex to-apex2";
  const text = tone === "violet" ? "text-violet-700 dark:text-violet-300" : "text-apex";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className={`text-sm font-bold tabular-nums ${text}`}>
          {value != null ? `${value}%` : "—"}
        </p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ${gradient}`}
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-muted">{detail}</p>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card rounded-2xl px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <span className="text-apex">{icon}</span> {label}
      </p>
      <p className="mt-1 text-xl font-extrabold tabular-nums">{value}</p>
      {hint ? <p className="text-[10px] text-muted">{hint}</p> : null}
    </div>
  );
}

function Section({
  title,
  exams,
  onOpen,
  empty,
  muted,
}: {
  title: string;
  exams: ExamVM[];
  onOpen: (id: string) => void;
  empty: string;
  muted?: boolean;
}) {
  if (exams.length === 0 && !empty) return null;
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
        <span className="rounded-full border border-line bg-surface px-1.5 py-0 text-[10px] font-medium tabular-nums">
          {exams.length}
        </span>
      </h3>
      {exams.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-4 text-center text-xs text-muted">
          {empty}
        </p>
      ) : (
        <div className="space-y-2">
          {exams.map((exam) => (
            <ExamRow key={exam.id} exam={exam} onOpen={onOpen} muted={muted} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExamRow({
  exam,
  onOpen,
  muted,
}: {
  exam: ExamVM;
  onOpen: (id: string) => void;
  muted?: boolean;
}) {
  const chip = statusChip(exam);
  return (
    <button
      onClick={() => onOpen(exam.id)}
      className={`card group flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-apex/30 hover:shadow-sm ${
        muted ? "opacity-80" : ""
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-apex-gradient text-white">
        <GraduationCap size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold transition-colors group-hover:text-apex">
            {exam.name}
          </span>
          <span className="chip border-line bg-surface px-1.5 py-0 text-[10px] text-muted">
            {EXAM_TYPE_LABEL[exam.type]}
          </span>
          <span className={`chip px-1.5 py-0 text-[10px] font-medium ${chip.className}`}>
            {chip.label}
          </span>
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={11} /> {fmtDate(exam.date)}
          </span>
          <span>
            {exam.progress.completedCount}/{exam.progress.conceptCount} covered
          </span>
          {exam.latestAttempt?.percentage != null ? (
            <span className="text-emerald-700 dark:text-emerald-300">
              Last result {exam.latestAttempt.percentage}%
            </span>
          ) : null}
        </p>
      </div>
      <div className="hidden w-36 shrink-0 sm:block">
        <div className="flex items-baseline justify-between gap-2 text-[10px] text-muted">
          <span>Coverage</span>
          <span className="font-semibold tabular-nums text-foreground">
            {exam.progress.coverage}%
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-apex-gradient transition-[width] duration-500"
            style={{ width: `${exam.progress.coverage}%` }}
          />
        </div>
        {exam.progress.readiness != null ? (
          <p className="mt-1 text-right text-[10px] text-muted">
            Readiness{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {exam.progress.readiness}%
            </span>
          </p>
        ) : null}
      </div>
      <ChevronRight
        size={16}
        className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-apex"
      />
    </button>
  );
}
