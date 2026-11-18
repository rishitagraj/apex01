import "server-only";
import { db } from "@/lib/db";
import { loadSyllabus } from "@/lib/syllabus";
import type { ConceptVM, SyllabusTree } from "@/types/syllabus";
import type {
  ExamAttemptSubjectMark,
  ExamAttemptVM,
  ExamChapterProgressVM,
  ExamDetailVM,
  ExamSubjectProgressVM,
  ExamSubjectRef,
  ExamVM,
} from "@/types/exams";
import {
  daysUntil,
  EXAM_COMPLETE_THRESHOLD,
  EXAM_REVISION_WINDOW_DAYS,
  examStatus,
  summarizeExamProgress,
} from "@/utils/exams";

type ExamRow = Awaited<ReturnType<typeof fetchExamRows>>[number];

async function fetchExamRows(userId: string, examId?: string) {
  return db.exam.findMany({
    where: { userId, ...(examId ? { id: examId } : {}) },
    orderBy: { date: "asc" },
    include: {
      subjects: { select: { subjectId: true } },
      chapters: { select: { chapterId: true } },
      concepts: { select: { conceptId: true } },
      attempts: { orderBy: [{ attemptDate: "desc" }, { createdAt: "desc" }] },
    },
  });
}

interface ConceptLocation {
  concept: ConceptVM;
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterName: string;
}

interface TreeIndex {
  concepts: Map<string, ConceptLocation>;
  subjectNames: Map<string, string>;
}

function indexTree(tree: SyllabusTree): TreeIndex {
  const concepts = new Map<string, ConceptLocation>();
  const subjectNames = new Map<string, string>();
  for (const subject of tree.subjects) {
    subjectNames.set(subject.id, subject.name);
    for (const chapter of subject.chapters) {
      for (const concept of chapter.concepts) {
        concepts.set(concept.id, {
          concept,
          subjectId: subject.id,
          subjectName: subject.name,
          chapterId: chapter.id,
          chapterName: chapter.name,
        });
      }
    }
  }
  return { concepts, subjectNames };
}

interface Scope {
  locations: ConceptLocation[];
  subjectIds: string[];
  subjects: ExamSubjectRef[];
}

function buildScope(exam: ExamRow, index: TreeIndex): Scope {
  const selectedChapters = new Set(exam.chapters.map((c) => c.chapterId));
  const selectedConcepts = new Set(exam.concepts.map((c) => c.conceptId));

  const effective = new Map<string, ConceptLocation>();
  for (const loc of index.concepts.values()) {
    if (selectedChapters.has(loc.chapterId)) effective.set(loc.concept.id, loc);
  }
  for (const cid of selectedConcepts) {
    const loc = index.concepts.get(cid);
    if (loc) effective.set(loc.concept.id, loc);
  }

  const locations = [...effective.values()];
  const subjectIds = new Set<string>(exam.subjects.map((s) => s.subjectId));
  for (const loc of locations) subjectIds.add(loc.subjectId);

  const subjects: ExamSubjectRef[] = [...subjectIds]
    .map((id) => ({ id, name: index.subjectNames.get(id) ?? "Removed subject" }))
    .filter((s) => index.subjectNames.has(s.id));

  return { locations, subjectIds: [...subjectIds], subjects };
}

function normalizeSubjectMarks(value: unknown): ExamAttemptSubjectMark[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v) => ({
      subjectId: typeof v.subjectId === "string" ? v.subjectId : null,
      name: typeof v.name === "string" ? v.name : "Subject",
      marks: typeof v.marks === "number" ? v.marks : null,
      maxMarks: typeof v.maxMarks === "number" ? v.maxMarks : null,
    }));
}

function toAttemptVM(a: ExamRow["attempts"][number]): ExamAttemptVM {
  const percentage =
    a.marks != null && a.maxMarks
      ? Math.round((a.marks / a.maxMarks) * 1000) / 10
      : null;
  return {
    id: a.id,
    attemptDate: a.attemptDate.toISOString().slice(0, 10),
    marks: a.marks,
    maxMarks: a.maxMarks,
    percentage,
    subjectMarks: normalizeSubjectMarks(a.subjectMarks),
    weakTopics: a.weakTopics,
    mistakes: a.mistakes,
    reflections: a.reflections,
    createdAt: a.createdAt.toISOString(),
  };
}

function toExamVM(exam: ExamRow, index: TreeIndex): ExamVM {
  const scope = buildScope(exam, index);
  const concepts = scope.locations.map((l) => l.concept);
  const attempts = exam.attempts.map(toAttemptVM);
  const date = exam.date.toISOString().slice(0, 10);
  const progress = summarizeExamProgress(concepts, EXAM_REVISION_WINDOW_DAYS);

  return {
    id: exam.id,
    name: exam.name,
    date,
    time: exam.time,
    type: exam.type,
    classLevel: exam.classLevel,
    notes: exam.notes,
    status: examStatus(date, attempts.length),
    daysUntil: daysUntil(date),
    subjectIds: scope.subjectIds,
    subjects: scope.subjects,
    chapterIds: exam.chapters.map((c) => c.chapterId),
    conceptIds: exam.concepts.map((c) => c.conceptId),
    progress,
    latestAttempt: attempts[0] ?? null,
    attemptCount: attempts.length,
    createdAt: exam.createdAt.toISOString(),
    updatedAt: exam.updatedAt.toISOString(),
  };
}

function subjectProgress(scope: Scope): ExamSubjectProgressVM[] {
  const bySubject = new Map<string, ConceptVM[]>();
  for (const loc of scope.locations) {
    const list = bySubject.get(loc.subjectId) ?? [];
    list.push(loc.concept);
    bySubject.set(loc.subjectId, list);
  }
  return scope.subjects
    .map((s) => {
      const concepts = bySubject.get(s.id) ?? [];
      const coverage = concepts.length
        ? Math.round(
            concepts.reduce((sum, c) => sum + c.coverage, 0) / concepts.length,
          )
        : 0;
      return {
        id: s.id,
        name: s.name,
        coverage,
        conceptCount: concepts.length,
        completedCount: concepts.filter(
          (c) => c.coverage >= EXAM_COMPLETE_THRESHOLD,
        ).length,
        needsRevisionCount: concepts.filter(
          (c) => c.needsRevision || c.status === "NEEDS_REVISION",
        ).length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function chapterProgress(exam: ExamRow, scope: Scope): ExamChapterProgressVM[] {
  const selectedChapters = new Set(exam.chapters.map((c) => c.chapterId));
  const byChapter = new Map<string, ConceptLocation[]>();
  for (const loc of scope.locations) {
    const list = byChapter.get(loc.chapterId) ?? [];
    list.push(loc);
    byChapter.set(loc.chapterId, list);
  }

  const out: ExamChapterProgressVM[] = [];
  for (const [chapterId, locations] of byChapter) {
    const first = locations[0];
    const concepts = locations.map((l) => l.concept);
    const coverage = concepts.length
      ? Math.round(
          concepts.reduce((sum, c) => sum + c.coverage, 0) / concepts.length,
        )
      : 0;
    out.push({
      id: chapterId,
      name: first.chapterName,
      subjectId: first.subjectId,
      subjectName: first.subjectName,
      included: selectedChapters.has(chapterId) ? "full" : "partial",
      coverage,
      conceptCount: concepts.length,
      completedCount: concepts.filter(
        (c) => c.coverage >= EXAM_COMPLETE_THRESHOLD,
      ).length,
      needsRevisionCount: concepts.filter(
        (c) => c.needsRevision || c.status === "NEEDS_REVISION",
      ).length,
      concepts: concepts.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  return out.sort(
    (a, b) =>
      a.subjectName.localeCompare(b.subjectName) ||
      a.name.localeCompare(b.name),
  );
}

const STATUS_ORDER: Record<ExamVM["status"], number> = {
  upcoming: 0,
  completed: 1,
  past: 2,
};

/** Loads every exam for a user with live, syllabus-derived progress. */
export async function loadExams(userId: string): Promise<ExamVM[]> {
  const tree = await loadSyllabus(userId);
  const index = indexTree(tree);
  const rows = await fetchExamRows(userId).catch(() => []);

  const vms = rows.map((row) => toExamVM(row, index));
  return vms.sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    return a.status === "upcoming"
      ? a.daysUntil - b.daysUntil
      : b.date.localeCompare(a.date);
  });
}

/** Loads a single exam (scoped to the user) with detailed breakdowns. */
export async function loadExamDetail(
  userId: string,
  examId: string,
): Promise<ExamDetailVM | null> {
  const [tree, rows] = await Promise.all([
    loadSyllabus(userId),
    fetchExamRows(userId, examId),
  ]);
  const exam = rows[0];
  if (!exam) return null;

  const index = indexTree(tree);
  const scope = buildScope(exam, index);
  const base = toExamVM(exam, index);
  const concepts = scope.locations.map((l) => l.concept);

  const focus = concepts
    .filter(
      (c) =>
        c.status === "WEAK" ||
        c.status === "NEEDS_REVISION" ||
        c.needsRevision,
    )
    .sort((a, b) => a.coverage - b.coverage);
  const untested = concepts
    .filter((c) => c.coverage < EXAM_COMPLETE_THRESHOLD)
    .sort((a, b) => a.coverage - b.coverage);

  return {
    ...base,
    subjectProgress: subjectProgress(scope),
    chapterProgress: chapterProgress(exam, scope),
    focusConcepts: focus,
    untestedConcepts: untested,
    attempts: exam.attempts.map(toAttemptVM),
  };
}

/**
 * Verifies every selected syllabus id belongs to the user's own syllabus before
 * an exam is written — this is the RLS-equivalent ownership gate.
 */
export async function resolveOwnedScope(
  userId: string,
  input: { subjectIds: string[]; chapterIds: string[]; conceptIds: string[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { subjectIds, chapterIds, conceptIds } = input;

  if (subjectIds.length > 0) {
    const count = await db.subject.count({
      where: { userId, id: { in: subjectIds } },
    });
    if (count !== new Set(subjectIds).size) {
      return { ok: false, error: "One or more subjects are not in your syllabus." };
    }
  }
  if (chapterIds.length > 0) {
    const count = await db.chapter.count({
      where: { id: { in: chapterIds }, subject: { userId } },
    });
    if (count !== new Set(chapterIds).size) {
      return { ok: false, error: "One or more chapters are not in your syllabus." };
    }
  }
  if (conceptIds.length > 0) {
    const count = await db.concept.count({
      where: { id: { in: conceptIds }, chapter: { subject: { userId } } },
    });
    if (count !== new Set(conceptIds).size) {
      return { ok: false, error: "One or more concepts are not in your syllabus." };
    }
  }
  return { ok: true };
}

/** Unions explicit subject ids with the subjects the chosen chapters/concepts belong to. */
export async function deriveExamSubjectIds(
  subjectIds: string[],
  chapterIds: string[],
  conceptIds: string[],
): Promise<string[]> {
  const ids = new Set<string>(subjectIds);
  if (chapterIds.length > 0) {
    const chapters = await db.chapter.findMany({
      where: { id: { in: chapterIds } },
      select: { subjectId: true },
    });
    for (const c of chapters) ids.add(c.subjectId);
  }
  if (conceptIds.length > 0) {
    const concepts = await db.concept.findMany({
      where: { id: { in: conceptIds } },
      select: { chapter: { select: { subjectId: true } } },
    });
    for (const c of concepts) ids.add(c.chapter.subjectId);
  }
  return [...ids];
}
