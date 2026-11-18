import type { ConceptVM } from "@/types/syllabus";
import type {
  ExamPlanProposal,
  ExamPlanTask,
  ExamPlanUnscheduled,
  ExamProgressVM,
  ExamStatus,
  ReadinessLevel,
} from "@/types/exams";
import { isRevisionDue, toDateKey } from "@/utils/revision";

/** Concepts not revised within this window count as "needs revision". */
export const EXAM_REVISION_WINDOW_DAYS = 7;

/** Coverage at/above this counts as "demonstrated" for exam purposes. */
export const EXAM_COMPLETE_THRESHOLD = 75;

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Parses a yyyy-mm-dd (or ISO) exam date into a local-midnight Date. */
export function parseExamDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatExamDate(iso: string): string {
  return parseExamDate(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Whole days from today to the exam (negative when in the past). */
export function daysUntil(iso: string): number {
  const exam = parseExamDate(iso).getTime();
  const today = startOfToday().getTime();
  return Math.round((exam - today) / 86_400_000);
}

export function examStatus(dateIso: string, attemptCount: number): ExamStatus {
  if (attemptCount > 0) return "completed";
  return daysUntil(dateIso) >= 0 ? "upcoming" : "past";
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function levelFor(readiness: number): ReadinessLevel {
  if (readiness < 50) return "low";
  if (readiness < EXAM_COMPLETE_THRESHOLD) return "medium";
  return "high";
}

/** A started concept is "behind on revision" if flagged or not revised recently. */
function behindOnRevision(concept: ConceptVM, windowDays: number): boolean {
  if (concept.needsRevision) return true;
  if (concept.status === "NEEDS_REVISION") return true;
  if (concept.coverage <= 0) return false;
  if (!concept.lastRevisedAt) return true;
  return isRevisionDue(new Date(concept.lastRevisedAt), windowDays);
}

/**
 * Exam readiness (0–100) blends three measured signals from existing syllabus
 * data. Apex tracks no quiz/recall scores, so none are invented:
 *
 *   · mastery      (weight 0.5) — mean concept coverage in the exam scope.
 *   · revision     (weight 0.3) — share of started concepts that are neither
 *                                 flagged nor overdue for revision.
 *   · demonstrated (weight 0.2) — share of in-scope concepts already at or
 *                                 above the completion threshold (>= 75).
 *
 * Returns `readiness: null` (level "insufficient") when the scope is empty or
 * no concept has any evidence yet — readiness is never fabricated.
 */
export function computeExamReadiness(
  concepts: ConceptVM[],
  windowDays = EXAM_REVISION_WINDOW_DAYS,
): { readiness: number | null; level: ReadinessLevel } {
  const total = concepts.length;
  if (total === 0) return { readiness: null, level: "insufficient" };

  const started = concepts.filter((c) => c.coverage > 0);
  if (started.length === 0) return { readiness: null, level: "insufficient" };

  const mastery = average(concepts.map((c) => c.coverage));
  const behind = started.filter((c) => behindOnRevision(c, windowDays)).length;
  const revisionHealth = 100 * (1 - behind / started.length);
  const demonstrated =
    100 *
    (concepts.filter((c) => c.coverage >= EXAM_COMPLETE_THRESHOLD).length /
      total);

  const readiness = clamp(
    Math.round(0.5 * mastery + 0.3 * revisionHealth + 0.2 * demonstrated),
  );
  return { readiness, level: levelFor(readiness) };
}

/** Rough per-concept study minutes remaining, by difficulty. */
export function estimateConceptMinutes(concept: ConceptVM): number {
  const key = concept.difficulty.toLowerCase();
  if (key.includes("easy")) return 25;
  if (key.includes("hard") || key.includes("advanced") || key.includes("difficult"))
    return 45;
  return 35;
}

/** Aggregates an exam's scoped concepts into dashboard progress metrics. */
export function summarizeExamProgress(
  concepts: ConceptVM[],
  windowDays = EXAM_REVISION_WINDOW_DAYS,
): ExamProgressVM {
  const total = concepts.length;
  const coverage = total
    ? Math.round(average(concepts.map((c) => c.coverage)))
    : 0;
  const started = concepts.filter((c) => c.coverage > 0).length;
  const completed = concepts.filter(
    (c) => c.coverage >= EXAM_COMPLETE_THRESHOLD,
  ).length;
  const { readiness, level } = computeExamReadiness(concepts, windowDays);

  return {
    coverage,
    readiness,
    readinessLevel: level,
    conceptCount: total,
    startedCount: started,
    completedCount: completed,
    masteredCount: concepts.filter((c) => c.status === "MASTERED").length,
    weakCount: concepts.filter((c) => c.status === "WEAK").length,
    needsRevisionCount: concepts.filter((c) => behindOnRevision(c, windowDays))
      .length,
    untouchedCount: total - started,
    untestedCount: total - completed,
    remainingMinutes: concepts
      .filter((c) => c.coverage < EXAM_COMPLETE_THRESHOLD)
      .reduce((s, c) => s + estimateConceptMinutes(c), 0),
  };
}

export interface PlanConceptEntry {
  concept: ConceptVM;
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterName: string;
}

export interface PlanTodoEntry {
  title: string;
  notes: string | null;
  completed: boolean;
  dueDate: string | null;
}

export interface PlanCompetingExam {
  name: string;
  date: string;
}

/**
 * Builds a preparation plan that maps unfinished exam concepts onto dated to-do
 * tasks. Heuristics (documented, deterministic):
 *
 *  · Only concepts below the completion threshold need work.
 *  · Done-ness ordering: weak/flagged concepts first, then lowest coverage,
 *    then concepts other in-scope concepts depend on (prerequisites), then
 *    untouched/hard topics.
 *  · Daily budget = weeklyTargetHours * 60 / 7, minus ~30 min reserved for each
 *    existing pending task already due that day (so we respect the schedule).
 *  · At most one task per concept per exam; concepts already planned for this
 *    exam (matched by a hidden marker in the task notes) are skipped.
 *  · When the window is too short for everything, only the highest-priority
 *    concepts are scheduled and the rest are returned as `unscheduled`, with a
 *    conflict explaining the shortfall instead of overloading the planner.
 */
export function buildExamPrepPlan(input: {
  examId: string;
  examName: string;
  examDate: string;
  entries: PlanConceptEntry[];
  todos: PlanTodoEntry[];
  weeklyTargetHours: number;
  competingExams?: PlanCompetingExam[];
}): ExamPlanProposal {
  const {
    examId,
    examName,
    examDate,
    entries,
    todos,
    weeklyTargetHours,
    competingExams = [],
  } = input;

  const conflicts: string[] = [];
  const marker = `[apex-exam:${examId}]`;

  const until = daysUntil(examDate);
  const daysAvailable = until < 0 ? 0 : Math.max(1, until);

  const dayKeys: string[] = [];
  const base = startOfToday();
  for (let i = 0; i < daysAvailable; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dayKeys.push(toDateKey(d));
  }

  const dailyBudgetMinutes = Math.max(
    30,
    Math.round((weeklyTargetHours * 60) / 7),
  );

  const reservedPerDay = new Map<string, number>();
  for (const t of todos) {
    if (t.completed || !t.dueDate) continue;
    const key = t.dueDate.slice(0, 10);
    if (!dayKeys.includes(key)) continue;
    reservedPerDay.set(key, (reservedPerDay.get(key) ?? 0) + 30);
  }
  const budgetPerDay = dayKeys.map((key) =>
    Math.max(0, dailyBudgetMinutes - (reservedPerDay.get(key) ?? 0)),
  );
  const totalAvailableMinutes = budgetPerDay.reduce((s, b) => s + b, 0);

  // How many in-scope concepts list each concept as a prerequisite.
  const prereqCount = new Map<string, number>();
  for (const e of entries) {
    for (const pid of e.concept.prerequisites) {
      prereqCount.set(pid, (prereqCount.get(pid) ?? 0) + 1);
    }
  }

  const alreadyPlanned = new Set<string>();
  for (const t of todos) {
    const hay = `${t.title} ${t.notes ?? ""}`;
    if (!hay.includes(marker)) continue;
    const m = hay.match(/\[concept:([^\]]+)\]/);
    if (m) alreadyPlanned.add(m[1]);
  }

  const candidates = entries
    .filter((e) => e.concept.coverage < EXAM_COMPLETE_THRESHOLD)
    .map((e) => {
      const c = e.concept;
      const weak =
        c.status === "WEAK" ||
        c.needsRevision ||
        c.status === "NEEDS_REVISION";
      const difficulty = c.difficulty.toLowerCase();
      const hard =
        difficulty.includes("hard") ||
        difficulty.includes("advanced") ||
        difficulty.includes("difficult");
      const score =
        (weak ? 40 : 0) +
        ((EXAM_COMPLETE_THRESHOLD - c.coverage) / EXAM_COMPLETE_THRESHOLD) * 30 +
        (prereqCount.get(c.id) ?? 0) * 8 +
        (c.status === "NOT_STARTED" ? 10 : 0) +
        (hard ? 8 : 0);
      const minutes = Math.round(
        estimateConceptMinutes(c) * (weak ? 1.5 : 1),
      );
      const action =
        c.coverage === 0 ? "Start" : weak ? "Revise & practice" : "Revise";
      const priority: ExamPlanTask["priority"] = weak || c.coverage < 40 ? "HIGH" : "MEDIUM";
      const reason =
        c.coverage === 0
          ? "Not started yet"
          : weak
            ? "Weak / flagged for revision"
            : "In progress";
      return { e, score, minutes, action, priority, reason };
    })
    .sort((a, b) => b.score - a.score);

  const totalRequiredMinutes = candidates.reduce((s, c) => s + c.minutes, 0);

  const tasks: ExamPlanTask[] = [];
  const unscheduled: ExamPlanUnscheduled[] = [];
  let duplicatesSkipped = 0;

  let dayIdx = 0;
  let usedToday = 0;

  for (const cand of candidates) {
    if (alreadyPlanned.has(cand.e.concept.id)) {
      duplicatesSkipped += 1;
      continue;
    }

    // Find the next day with room for this session.
    while (
      dayIdx < dayKeys.length &&
      usedToday + cand.minutes > budgetPerDay[dayIdx]
    ) {
      dayIdx += 1;
      usedToday = 0;
    }
    if (dayIdx >= dayKeys.length) {
      unscheduled.push({
        conceptId: cand.e.concept.id,
        name: cand.e.concept.name,
        reason: "No room left before the exam",
      });
      continue;
    }

    usedToday += cand.minutes;
    tasks.push({
      title: `${cand.action}: ${cand.e.concept.name}`,
      notes: `Exam: ${examName} · ${cand.e.subjectName} › ${cand.e.chapterName} · ${cand.e.concept.name} ${marker}[concept:${cand.e.concept.id}]`,
      priority: cand.priority,
      dueDate: dayKeys[dayIdx],
      conceptId: cand.e.concept.id,
      subjectName: cand.e.subjectName,
      chapterName: cand.e.chapterName,
      reason: cand.reason,
      minutes: cand.minutes,
    });
  }

  tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (daysAvailable === 0) {
    conflicts.push(
      "The exam is today or already past — there is no preparation window left.",
    );
  }
  if (totalRequiredMinutes > totalAvailableMinutes && tasks.length > 0) {
    const gap = totalRequiredMinutes - totalAvailableMinutes;
    conflicts.push(
      `Your ${daysAvailable}-day window holds about ${totalAvailableMinutes} min of study budget, but finishing every topic needs ~${totalRequiredMinutes} min (a ${gap} min shortfall). The plan schedules your highest-priority topics first — consider trimming scope, adding study time, or accepting some topics at a "read-only" level.`,
    );
  } else if (unscheduled.length > 0) {
    conflicts.push(
      `${unscheduled.length} topic(s) could not be scheduled before the exam.`,
    );
  }

  const windowEnd = dayKeys[dayKeys.length - 1];
  const others = competingExams.filter(
    (x) => x.date.slice(0, 10) <= (windowEnd ?? examDate.slice(0, 10)) &&
      x.date.slice(0, 10) >= (dayKeys[0] ?? examDate.slice(0, 10)),
  );
  if (others.length > 0) {
    conflicts.push(
      `${others.length} other exam(s) (${others
        .map((o) => o.name)
        .join(", ")}) fall in the same window; their planned tasks already count against the daily budget.`,
    );
  }

  return {
    examId,
    examName,
    examDate,
    daysAvailable,
    dailyBudgetMinutes,
    totalAvailableMinutes,
    totalRequiredMinutes,
    tasks,
    unscheduled,
    conflicts,
    duplicatesSkipped,
  };
}
