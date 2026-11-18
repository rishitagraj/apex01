"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  X,
  Loader2,
  Wand2,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Clock,
} from "lucide-react";
import type { ExamPlanProposal } from "@/types/exams";

function formatDay(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function hours(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = mins / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}

export function ExamPlanDialog({
  examId,
  examName,
  onClose,
  onApplied,
}: {
  examId: string;
  examName: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [plan, setPlan] = useState<ExamPlanProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [created, setCreated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/exams/${examId}/plan`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("plan failed"))))
      .then((data: { plan: ExamPlanProposal }) => {
        if (!cancelled) setPlan(data.plan);
      })
      .catch(() => {
        if (!cancelled) setError("Could not build a prep plan right now.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [examId]);

  async function apply() {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${examId}/plan`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data?.error as string) || "Could not add tasks.");
        return;
      }
      setCreated(data.created as number);
      onApplied();
    } catch {
      setError("Network error while adding tasks.");
    } finally {
      setApplying(false);
    }
  }

  const byDate = new Map<string, ExamPlanProposal["tasks"]>();
  if (plan) {
    for (const task of plan.tasks) {
      const list = byDate.get(task.dueDate) ?? [];
      list.push(task);
      byDate.set(task.dueDate, list);
    }
  }
  const days = [...byDate.keys()].sort();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-line bg-card sm:h-[84vh] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">Prep plan</h2>
            <p className="text-xs text-muted">
              Study tasks derived from {examName}&apos;s unfinished concepts.
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

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-sm text-muted">
              <Loader2 size={16} className="animate-spin" /> Planning your schedule…
            </div>
          ) : created != null ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCircle2 size={40} className="text-emerald-400" />
              <p className="text-sm font-semibold">
                {created === 0
                  ? "Everything was already planned."
                  : `Added ${created} task${created === 1 ? "" : "s"} to your planner.`}
              </p>
              <div className="flex gap-2">
                <Link href="/todos" className="btn bg-apex-gradient text-white">
                  Open planner
                </Link>
                <button onClick={onClose} className="btn">
                  Done
                </button>
              </div>
            </div>
          ) : error && !plan ? (
            <p className="py-12 text-center text-sm text-muted">{error}</p>
          ) : plan ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Meta label="Days left" value={String(plan.daysAvailable)} />
                <Meta label="Daily budget" value={hours(plan.dailyBudgetMinutes)} />
                <Meta label="Work needed" value={hours(plan.totalRequiredMinutes)} />
                <Meta label="Suggested tasks" value={String(plan.tasks.length)} />
              </div>

              {plan.conflicts.length > 0 ? (
                <div className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                  {plan.conflicts.map((c, i) => (
                    <p key={i} className="flex items-start gap-2 text-xs text-amber-300">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      {c}
                    </p>
                  ))}
                </div>
              ) : null}

              {plan.tasks.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">
                  Nothing to schedule — every concept in this exam is already covered.
                </p>
              ) : (
                <div className="space-y-4">
                  {days.map((day) => (
                    <div key={day}>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
                        <CalendarDays size={13} /> {formatDay(day)}
                      </p>
                      <div className="space-y-1.5">
                        {byDate.get(day)!.map((t, i) => (
                          <div
                            key={`${t.conceptId}-${i}`}
                            className="rounded-xl border border-line bg-black/20 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-[13px] font-medium">
                                {t.title}
                              </span>
                              <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
                                <Clock size={11} /> {hours(t.minutes)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted">
                              {t.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {plan.unscheduled.length > 0 ? (
                <div className="rounded-xl border border-line bg-surface p-3">
                  <p className="mb-1 text-xs font-semibold text-muted">
                    Not scheduled in time ({plan.unscheduled.length})
                  </p>
                  <p className="text-[11px] leading-relaxed text-muted">
                    {plan.unscheduled.map((u) => u.name).join(", ")}
                  </p>
                </div>
              ) : null}

              {plan.duplicatesSkipped > 0 ? (
                <p className="text-[11px] text-muted">
                  {plan.duplicatesSkipped} task(s) already added previously were skipped.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {plan && created == null ? (
          <div className="border-t border-line px-5 py-3">
            {error ? <p className="mb-2 text-xs text-rose-400">{error}</p> : null}
            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className="btn">
                Cancel
              </button>
              <button
                onClick={apply}
                disabled={applying || plan.tasks.length === 0}
                className="btn bg-apex-gradient text-white"
              >
                {applying ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Wand2 size={15} />
                )}
                Add {plan.tasks.length} task{plan.tasks.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-black/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}
