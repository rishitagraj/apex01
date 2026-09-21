import "server-only";
import { db } from "@/lib/db";
import { computeCoverage, defaultChecklistState, deriveStatus } from "@/utils/progress";

/** RLS-equivalent ownership gate: the concept must hang under `userId`'s syllabus. */
export async function findOwnedConcept(conceptId: string, userId: string) {
  return db.concept.findFirst({
    where: { id: conceptId, chapter: { subject: { userId } } },
    select: { id: true },
  });
}

/** Re-derives mastery + status from stored checklist/confidence and persists both. */
export async function recomputeAndPersist(conceptId: string, userId: string) {
  const [progressRow, checklists] = await Promise.all([
    db.userConceptProgress.findUnique({
      where: { conceptId_userId: { conceptId, userId } },
    }),
    db.conceptChecklist.findMany({ where: { conceptId, userId } }),
  ]);

  const done = defaultChecklistState(
    Object.fromEntries(checklists.map((c) => [c.task, c.done])) as Record<string, boolean>,
  );
  const confidence = progressRow?.confidence ?? 0;
  const needsRevision = progressRow?.needsRevision ?? false;
  const coverage = computeCoverage(done, confidence);
  const status = deriveStatus(coverage, confidence, needsRevision);

  await db.userConceptProgress.upsert({
    where: { conceptId_userId: { conceptId, userId } },
    create: { conceptId, userId, coverage, confidence, needsRevision, status },
    update: { coverage, status },
  });

  return { coverage, status };
}