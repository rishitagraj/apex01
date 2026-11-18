import type { ConceptVM } from "@/types/syllabus";

export type ExamType = "UNIT_TEST" | "MIDTERM" | "ANNUAL" | "QUIZ" | "CUSTOM";

export const EXAM_TYPES: ExamType[] = [
  "UNIT_TEST",
  "MIDTERM",
  "ANNUAL",
  "QUIZ",
  "CUSTOM",
];

export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  UNIT_TEST: "Unit test",
  MIDTERM: "Midterm",
  ANNUAL: "Annual examination",
  QUIZ: "Quiz",
  CUSTOM: "Custom",
};

/**
 * Lifecycle bucket for an exam:
 *  · upcoming  — the exam date is today or later and no result recorded yet
 *  · completed — a result has been recorded (regardless of date)
 *  · past      — the date has passed and no result was recorded
 */
export type ExamStatus = "upcoming" | "completed" | "past";

export type ReadinessLevel = "insufficient" | "low" | "medium" | "high";

export interface ExamSubjectRef {
  id: string;
  name: string;
}

export interface ExamProgressVM {
  /** Average concept coverage across only the concepts in this exam. */
  coverage: number;
  /** 0–100, or null when there is no evidence yet. */
  readiness: number | null;
  readinessLevel: ReadinessLevel;
  conceptCount: number;
  startedCount: number;
  /** Concepts at coverage >= 75 (COMPLETED or MASTERED). */
  completedCount: number;
  masteredCount: number;
  weakCount: number;
  needsRevisionCount: number;
  /** Coverage === 0. */
  untouchedCount: number;
  /** Coverage < 75 — not demonstrated through the mastery model yet. */
  untestedCount: number;
  /** Rough remaining study minutes for the untouched/unfinished concepts. */
  remainingMinutes: number;
}

export interface ExamAttemptSubjectMark {
  subjectId: string | null;
  name: string;
  marks: number | null;
  maxMarks: number | null;
}

export interface ExamAttemptVM {
  id: string;
  attemptDate: string;
  marks: number | null;
  maxMarks: number | null;
  percentage: number | null;
  subjectMarks: ExamAttemptSubjectMark[];
  weakTopics: string | null;
  mistakes: string | null;
  reflections: string | null;
  createdAt: string;
}

export interface ExamVM {
  id: string;
  name: string;
  /** yyyy-mm-dd */
  date: string;
  time: string | null;
  type: ExamType;
  classLevel: string | null;
  notes: string | null;
  status: ExamStatus;
  /** Whole days from today (negative when the date is in the past). */
  daysUntil: number;
  subjectIds: string[];
  subjects: ExamSubjectRef[];
  chapterIds: string[];
  conceptIds: string[];
  progress: ExamProgressVM;
  latestAttempt: ExamAttemptVM | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExamSubjectProgressVM {
  id: string;
  name: string;
  coverage: number;
  conceptCount: number;
  completedCount: number;
  needsRevisionCount: number;
}

export interface ExamChapterProgressVM {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  /** "full" when the whole chapter is in scope, "partial" for picked concepts. */
  included: "full" | "partial";
  coverage: number;
  conceptCount: number;
  completedCount: number;
  needsRevisionCount: number;
  concepts: ConceptVM[];
}

export interface ExamDetailVM extends ExamVM {
  subjectProgress: ExamSubjectProgressVM[];
  chapterProgress: ExamChapterProgressVM[];
  /** Weak / flagged concepts to prioritise. */
  focusConcepts: ConceptVM[];
  /** Concepts not demonstrated yet (coverage < 75). */
  untestedConcepts: ConceptVM[];
  attempts: ExamAttemptVM[];
}

export interface ExamPlanTask {
  title: string;
  notes: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  /** yyyy-mm-dd */
  dueDate: string;
  conceptId: string;
  subjectName: string;
  chapterName: string;
  reason: string;
  minutes: number;
}

export interface ExamPlanUnscheduled {
  conceptId: string;
  name: string;
  reason: string;
}

export interface ExamPlanProposal {
  examId: string;
  examName: string;
  examDate: string;
  daysAvailable: number;
  dailyBudgetMinutes: number;
  totalAvailableMinutes: number;
  totalRequiredMinutes: number;
  tasks: ExamPlanTask[];
  unscheduled: ExamPlanUnscheduled[];
  conflicts: string[];
  duplicatesSkipped: number;
}

export interface ExamInput {
  name: string;
  date: string;
  time?: string | null;
  type: ExamType;
  classLevel?: string | null;
  notes?: string | null;
  subjectIds: string[];
  chapterIds: string[];
  conceptIds: string[];
}
