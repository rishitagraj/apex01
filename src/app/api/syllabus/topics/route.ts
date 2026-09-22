import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { CHECKLIST_ORDER, type RevisionKind } from "@/types/syllabus";

export const runtime = "nodejs";

const REVISION_OFFSETS = [2, 7, 14, 30] as const;

// Adds a single chapter ("topic") with optional concepts into an existing,
// owned subject. Creates the default 11-step checklist (labels included) and a
// revision schedule per concept so new topics behave like imported ones.
export async function POST(req: Request) {
  const userId = await verifySession();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { subjectId?: string; name?: string; concepts?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subjectId = String(body.subjectId ?? "");
  const name = String(body.name ?? "").trim();
  if (!subjectId || !name) {
    return Response.json({ error: "subjectId and name required" }, { status: 400 });
  }

  const subject = await db.subject.findFirst({
    where: { id: subjectId, userId },
    select: { id: true },
  });
  if (!subject) return Response.json({ error: "Subject not found" }, { status: 404 });

  const concepts = Array.isArray(body.concepts)
    ? body.concepts.map((c) => String(c).trim()).filter(Boolean)
    : [];

  try {
    const created = await db.$transaction(async (tx) => {
      const last = await tx.chapter.findFirst({
        where: { subjectId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const chapter = await tx.chapter.create({
        data: {
          subjectId,
          name,
          description: null,
          order: (last?.order ?? -1) + 1,
          difficulty: "Medium",
        },
        select: { id: true },
      });

      for (const [ci, cn] of concepts.entries()) {
        const concept = await tx.concept.create({
          data: {
            chapterId: chapter.id,
            name: cn,
            difficulty: "Medium",
            order: ci,
            tags: [],
            learningObjectives: [],
          },
          select: { id: true },
        });

        await tx.conceptChecklist.createMany({
          data: CHECKLIST_ORDER.map((t) => ({
            conceptId: concept.id,
            userId,
            task: t.task,
            label: t.label,
            order: CHECKLIST_ORDER.indexOf(t),
          })),
        });

        const today = new Date();
        await tx.revisionSchedule.createMany({
          data: REVISION_OFFSETS.map((offset, i) => {
            const d = new Date(today);
            d.setDate(d.getDate() + offset);
            return {
              conceptId: concept.id,
              userId,
              date: d,
              kind: `REVISION_${i + 1}`,
            };
          }) as { conceptId: string; userId: string; date: Date; kind: RevisionKind }[],
        });
      }

      return { id: chapter.id, concepts: concepts.length };
    });

    return Response.json({
      ok: true,
      chapter: { id: created.id, subjectId, name },
      concepts: created.concepts,
    });
  } catch (err) {
    console.error("syllabus/topics failed", err);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}