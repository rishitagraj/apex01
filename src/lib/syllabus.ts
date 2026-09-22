import "server-only";
import { db } from "@/lib/db";
import { CHECKLIST_ORDER, type SyllabusTree } from "@/types/syllabus";
import {
  CHECKLIST_WEIGHTS,
  computeCoverage,
  customChecklistPoints,
  defaultChecklistState,
  deriveStatus,
} from "@/utils/progress";
import { distinctRevisionDays, isRevisionDue } from "@/utils/revision";
import { computeStreak } from "@/utils/revision";

/**
 * Loads a user's entire syllabus tree (subjects → chapters → concepts) with
 * live progress, checklists, resources, revision history and notes, and
 * derives mastery/status server-side — the single source of truth the APIs
 * and dashboard both consume.
 *
 * Fails softly: if the syllabus tables don't exist yet (migration not pushed)
 * or any DB hiccup, the dashboard renders its empty state instead of crashing.
 */
export async function loadSyllabus(userId: string): Promise<SyllabusTree> {
  try {
    const subjects = await db.subject.findMany({
      where: { userId },
      orderBy: { order: "asc" },
      include: {
        chapters: {
          orderBy: { order: "asc" },
          include: {
            concepts: {
              orderBy: { order: "asc" },
              include: {
                progress: true,
                checklists: true,
                customChecklists: { orderBy: { order: "asc" } },
                revisions: { orderBy: { revisedAt: "desc" }, take: 20 },
                resources: { orderBy: { createdAt: "desc" }, take: 50 },
                notes: true,
                dependencies: { select: { prerequisiteId: true } },
              },
            },
          },
        },
      },
    });

    const tree = subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      classLevel: subject.classLevel,
      examTags: subject.examTags,
      order: subject.order,
      chapters: subject.chapters.map((chapter) => {
        const concepts = chapter.concepts.map((concept) => {
          const stored = concept.progress;
          const doneByTask = defaultChecklistState(
            Object.fromEntries(
              concept.checklists.map((c) => [c.task, c.done]),
            ) as Record<string, boolean>,
          );
          // Stored checklist rows may be partial after an import; fold their
          // saved state into the full default checklist so weights stay valid.
          const checklist = [
            ...CHECKLIST_ORDER.map((c) => {
              const saved = concept.checklists.find((r) => r.task === c.task);
              const isDone = saved?.done ?? doneByTask[c.task] ?? false;
              const defaultDone =
                !saved && doneByTask[c.task] === undefined ? false : isDone;
              return {
                id: saved?.id ?? null,
                task: c.task,
                label: c.label,
                weight: CHECKLIST_WEIGHTS[c.task],
                done: saved ? saved.done : defaultDone,
              };
            }),
            ...concept.customChecklists.map((c) => ({
              id: c.id,
              task: null,
              label: c.label,
              weight: c.weight,
              done: c.done,
            })),
          ];

          const doneMap = Object.fromEntries(
            checklist.map((c) => [c.task, c.done]),
          ) as Record<string, boolean>;
          const confidence = stored?.confidence ?? 0;
          const needsRevision = stored?.needsRevision ?? false;
          const mastery = computeCoverage(
            doneMap as never,
            confidence,
            customChecklistPoints(concept.customChecklists),
          );
          const status = deriveStatus(mastery, confidence, needsRevision);
          const lastRevisedAt = concept.revisions[0]?.revisedAt ?? null;
          const resources = concept.resources.map((r) => ({
            id: r.id,
            kind: r.kind,
            title: r.title,
            url: r.url,
            key: r.key,
            size: r.size,
            favourite: r.favourite,
            createdAt: r.createdAt.toISOString(),
          }));

          return {
            id: concept.id,
            name: concept.name,
            description: concept.description,
            difficulty: concept.difficulty,
            status,
            coverage: mastery,
            confidence,
            studyMinutes:
              concept.studyMinutes + (stored?.studyMinutes ?? 0),
            lastRevisedAt: lastRevisedAt?.toISOString() ?? null,
            tags: concept.tags,
            learningObjectives: concept.learningObjectives,
            estimatedHours: concept.estimatedHours,
            resourceCount: resources.length,
            mistakesCount: 0,
            checklist,
            checklistDone: checklist.filter((c) => c.done).length,
            checklistTotal: checklist.length,
            needsRevision,
            notes: concept.notes?.body ?? "",
            revisions: concept.revisions.map((r) => ({
              id: r.id,
              kind: r.kind,
              note: r.note,
              revisedAt: r.revisedAt.toISOString(),
            })),
            resources,
            prerequisites: concept.dependencies.map(
              (d) => d.prerequisiteId,
            ),
          };
        });

        const covered = concepts.filter(
          (c) => c.status === "MASTERED" || c.status === "COMPLETED",
        ).length;
        const revisionDue = concepts.filter(
          (c) =>
            c.needsRevision ||
            (c.lastRevisedAt &&
              isRevisionDue(new Date(c.lastRevisedAt), 7)) ||
            (!c.lastRevisedAt && c.coverage > 0),
        ).length;
        const coverage = concepts.length
          ? Math.round(
              concepts.reduce((sum, c) => sum + c.coverage, 0) /
                concepts.length,
            )
          : 0;

        return {
          id: chapter.id,
          name: chapter.name,
          description: chapter.description,
          order: chapter.order,
          difficulty: chapter.difficulty ?? "Medium",
          estimatedHours: chapter.estimatedHours,
          conceptCount: concepts.length,
          completedCount: covered,
          coverage,
          revisionDue,
          resources: concepts.reduce((s, c) => s + c.resourceCount, 0),
          concepts,
        };
      }),
    }));

    const all = tree.flatMap((s) => s.chapters).flatMap((c) => c.concepts);
    const totalConcepts = all.length;
    const mastered = all.filter((c) => c.status === "MASTERED");
    const completed = all.filter(
      (c) => c.status === "MASTERED" || c.status === "COMPLETED",
    );
    const overall = totalConcepts
      ? Math.round(all.reduce((s, c) => s + c.coverage, 0) / totalConcepts)
      : 0;

    const revisionRows = await db.conceptRevision
      .findMany({
        where: { userId, revisedAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
        select: { revisedAt: true },
      })
      .catch(() => []);
    const streakDays = computeStreak(distinctRevisionDays(revisionRows));

    const totalStudyMinutes = all.reduce((s, c) => s + c.studyMinutes, 0);

    return {
      subjects: tree,
      stats: {
        conceptsCompleted: completed.length,
        totalConcepts,
        coverage: overall,
        needsRevision: all.filter((c) => c.status === "NEEDS_REVISION").length,
        weakCount: all.filter((c) => c.status === "WEAK").length,
        masteredCount: mastered.length,
        streakDays,
        totalStudyMinutes,
      },
    };
  } catch {
    return {
      subjects: [],
      stats: {
        conceptsCompleted: 0,
        totalConcepts: 0,
        coverage: 0,
        needsRevision: 0,
        weakCount: 0,
        masteredCount: 0,
        streakDays: 0,
        totalStudyMinutes: 0,
      },
    };
  }
}