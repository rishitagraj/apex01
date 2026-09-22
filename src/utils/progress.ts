import {
  CHECKLIST_ORDER,
  type ChecklistTask,
  type SyllabusStatus,
} from "@/types/syllabus";

// Mastery model (total = 100):
//   Checklist tasks ................ 90 points
//     Theory 10 · Notes 10 · Examples 15 · NCERT 20 · DPP 20 · PYQ 15
//     Lecture 5 · Revision 1-4 (1.25 each) ............ 5
//   User-added checklist steps ..... configurable (default 5 pts each)
//   Confidence slider .............. 10 points
// A 100/100 therefore requires the checklist done plus a confident self-rating.
export const CHECKLIST_WEIGHTS: Record<ChecklistTask, number> = {
  READ_THEORY: 10,
  WATCH_LECTURE: 5,
  WRITE_NOTES: 10,
  SOLVE_EXAMPLES: 15,
  NCERT_EXERCISE: 20,
  DPP: 20,
  PYQ: 15,
  REVISION_1: 1.25,
  REVISION_2: 1.25,
  REVISION_3: 1.25,
  REVISION_4: 1.25,
};

export const DEFAULT_CUSTOM_WEIGHT = 5;

export const DEFAULT_CHECKLIST: ChecklistTask[] = CHECKLIST_ORDER.map(
  (c) => c.task,
);

export function defaultChecklistState(done: Record<string, boolean> = {}) {
  return Object.fromEntries(
    DEFAULT_CHECKLIST.map((task) => [task, done[task] ?? false]),
  ) as Record<ChecklistTask, boolean>;
}

/** Checklist points earned (0-90) plus any user-added step points. */
export function checklistPoints(
  done: Record<ChecklistTask, boolean>,
  extraPoints = 0,
): number {
  return (
    DEFAULT_CHECKLIST.reduce(
      (sum, task) => sum + (done[task] ? CHECKLIST_WEIGHTS[task] : 0),
      0,
    ) + extraPoints
  );
}

/** Points earned by user-added checklist steps (done items only). */
export function customChecklistPoints(
  items: { done: boolean; weight: number }[],
): number {
  return items.reduce((sum, i) => sum + (i.done ? i.weight : 0), 0);
}

/** Confidence contribution (0-10). */
export function confidencePoints(confidence: number): number {
  return Math.max(0, Math.min(100, confidence)) / 10;
}

/** 0-100 mastery. `done` may be a partial map; unknown tasks count as undone. */
export function computeCoverage(
  done: Partial<Record<ChecklistTask, boolean>>,
  confidence: number,
  extraPoints = 0,
): number {
  const full: Record<ChecklistTask, boolean> = defaultChecklistState(
    done as Record<string, boolean>,
  );
  const total = checklistPoints(full, extraPoints) + confidencePoints(confidence);
  return Math.round(Math.min(100, Math.max(0, total)));
}

/** Auto-derived status from mastery, confidence and revision flags. */
export function deriveStatus(
  mastery: number,
  confidence: number,
  needsRevision: boolean,
): SyllabusStatus {
  if (needsRevision) return "NEEDS_REVISION";
  if (mastery >= 90) return "MASTERED";
  if (mastery >= 75) return "COMPLETED";
  if (mastery > 0 && confidence < 40) return "WEAK";
  if (mastery > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
}