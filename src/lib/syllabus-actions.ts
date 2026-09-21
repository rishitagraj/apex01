import "server-only";
import { db } from "@/lib/db";
import {
  CHECKLIST_ORDER,
  type ParseOptions,
  type RevisionKind,
  type RoadmapDraft,
} from "@/types/syllabus";
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

const REVISION_OFFSETS = [2, 7, 14, 30] as const;

function buildLookup(
  chapters: { name: string; concepts: { name: string; ref: string }[] }[],
) {
  const global = new Map<string, string>();
  const byChapter = new Map<string, Map<string, string>>();
  for (const ch of chapters) {
    const local = new Map<string, string>();
    for (const c of ch.concepts) {
      const key = c.name.toLowerCase().trim();
      if (!global.has(key)) global.set(key, c.ref);
      if (!local.has(key)) local.set(key, c.ref);
    }
    byChapter.set(ch.name.toLowerCase().trim(), local);
  }
  return { global, byChapter };
}

/**
 * Persists a validated roadmap into the user's syllabus tree transactionally:
 * subjects → chapters → concepts, with checklists, dependencies, revision
 * schedules and resources. Returns import summary counts.
 */
export async function persistRoadmap(
  userId: string,
  roadmap: RoadmapDraft,
  opts: Pick<
    ParseOptions,
    | "generateChecklist"
    | "generateRevisionSchedule"
    | "estimateHours"
    | "learningObjectives"
  >,
): Promise<{
  subjects: number;
  chapters: number;
  concepts: number;
  dependencies: number;
  revisions: number;
  resources: number;
}> {
  return db.$transaction(async (tx) => {
    let sCount = 0;
    let chCount = 0;
    let cCount = 0;
    let dCount = 0;
    let rCount = 0;
    let reCount = 0;

    for (const [si, subject] of roadmap.subjects.entries()) {
      const chaptersWithRefs = subject.chapters.map((ch) => ({
        name: ch.name,
        concepts: ch.concepts.map((c) => ({
          name: c.name,
          ref: `${si}-${c.name}`,
        })),
      }));
      const lookup = buildLookup(chaptersWithRefs);
      const byNameGlobal = lookup.global;

      const created = await tx.subject.create({
        data: {
          userId,
          name: subject.name,
          classLevel: subject.classLevel,
          examTags: subject.examTags ?? [],
          order: si,
        },
        select: { id: true },
      });
      sCount += 1;

      for (const [ci, chapter] of subject.chapters.entries()) {
        const createdChapter = await tx.chapter.create({
          data: {
            subjectId: created.id,
            name: chapter.name,
            description: chapter.description,
            order: ci,
            difficulty: "Medium",
          },
          select: { id: true },
        });
        chCount += 1;

        const conceptIdsByName = new Map<string, string>();
        for (const [ki, concept] of chapter.concepts.entries()) {
          const createdConcept = await tx.concept.create({
            data: {
              chapterId: createdChapter.id,
              name: concept.name,
              description: concept.description,
              difficulty: concept.difficulty ?? "Medium",
              order: ki,
              tags: concept.tags ?? [],
              learningObjectives:
                opts.learningObjectives ? (concept.learningObjectives ?? []) : [],
              estimatedHours: opts.estimateHours
                ? (concept.estimatedHours ?? null)
                : null,
            },
            select: { id: true },
          });
          cCount += 1;
          conceptIdsByName.set(concept.name.toLowerCase().trim(), createdConcept.id);
          byNameGlobal.set(
            concept.name.toLowerCase().trim(),
            createdConcept.id,
          );

          if (opts.generateChecklist) {
            await tx.conceptChecklist.createMany({
              data: CHECKLIST_ORDER.map((t) => ({
                conceptId: createdConcept.id,
                userId,
                task: t.task,
                order: CHECKLIST_ORDER.indexOf(t),
              })),
            });
          }

          if (opts.generateRevisionSchedule) {
            const today = new Date();
            await tx.revisionSchedule.createMany({
              data: REVISION_OFFSETS.map((offset, i) => {
                const d = new Date(today);
                d.setDate(d.getDate() + offset);
                return {
                  conceptId: createdConcept.id,
                  userId,
                  date: d,
                  kind: `REVISION_${i + 1}` as const,
                };
              }) as { conceptId: string; userId: string; date: Date; kind: RevisionKind }[],
            });
            reCount += REVISION_OFFSETS.length;
          }

          for (const resource of (concept.resources ?? [])) {
            await tx.conceptResource.create({
              data: {
                conceptId: createdConcept.id,
                userId,
                kind: reasonableKind(resource.kind),
                title: resource.title,
                url: resource.url,
                size: 0,
              },
            });
            rCount += 1;
          }
        }

        for (const concept of chapter.concepts) {
          for (const prereqName of concept.prerequisites ?? []) {
            const key = prereqName.toLowerCase().trim();
            const target = conceptIdsByName.get(key) ?? byNameGlobal.get(key);
            if (!target) continue;
            const source = conceptIdsByName.get(concept.name.toLowerCase().trim());
            if (!source || source === target) continue;
            await tx.conceptDependency.upsert({
              where: { conceptId_prerequisiteId: { conceptId: source, prerequisiteId: target } },
              create: { conceptId: source, prerequisiteId: target, userId },
              update: {},
            });
            dCount += 1;
          }
        }
      }
    }

    return {
      subjects: sCount,
      chapters: chCount,
      concepts: cCount,
      dependencies: dCount,
      revisions: reCount,
      resources: rCount,
    };
  });
}

function reasonableKind(kind?: string) {
  const map: Record<string, string> = {
    PDF: "PDF",
    IMAGE: "IMAGE",
    MARKDOWN: "MARKDOWN",
    FORMULA: "FORMULA",
    DPP: "DPP",
    PYQ: "PYQ",
    LINK: "LINK",
    YOUTUBE: "YOUTUBE",
  };
  return (map[kind?.toUpperCase() ?? ""] ?? "LINK") as
    | "LINK"
    | "PDF"
    | "IMAGE"
    | "MARKDOWN"
    | "FORMULA"
    | "DPP"
    | "PYQ"
    | "YOUTUBE";
}