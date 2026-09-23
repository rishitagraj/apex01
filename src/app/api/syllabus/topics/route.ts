import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { CHECKLIST_ORDER, type RevisionKind } from "@/types/syllabus";

export const runtime = "nodejs";

const REVISION_OFFSETS = [2, 7, 14, 30] as const;

interface ChapterInput {
  name: string;
  concepts: string[];
}

function parseBody(body: Record<string, unknown>): {
  subjectId: string | null;
  chapters: ChapterInput[];
} {
  const subjectId =
    typeof body.subjectId === "string" && body.subjectId.trim()
      ? body.subjectId.trim()
      : null;

  const chapters: ChapterInput[] = [];

  if (Array.isArray(body.chapters)) {
    for (const raw of body.chapters as unknown[]) {
      if (typeof raw !== "object" || raw === null) continue;
      const ch = raw as Record<string, unknown>;
      const name =
        typeof ch.name === "string" && ch.name.trim() ? ch.name.trim() : null;
      if (!name) continue;
      const concepts = Array.isArray(ch.concepts)
        ? ch.concepts.map((c) => String(c).trim()).filter(Boolean)
        : [];
      chapters.push({ name, concepts });
    }
  } else if (typeof body.name === "string" && body.name.trim()) {
    const concepts = Array.isArray(body.concepts)
      ? body.concepts.map((c) => String(c).trim()).filter(Boolean)
      : [];
    chapters.push({ name: body.name.trim(), concepts });
  }

  return { subjectId, chapters };
}

// Adds chapters ("topics") with optional concepts into an existing, owned
// subject. Creates the default 11-step checklist (labels included) and a
// revision schedule per concept so new topics behave like imported ones.
export async function POST(req: Request) {
  const userId = await verifySession();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { subjectId, chapters } = parseBody(body);
  if (!subjectId || chapters.length === 0) {
    return Response.json(
      { error: "subjectId and a chapter name (or chapters array) required" },
      { status: 400 },
    );
  }

  const subject = await db.subject.findFirst({
    where: { id: subjectId, userId },
    select: { id: true },
  });
  if (!subject) return Response.json({ error: "Subject not found" }, { status: 404 });

  try {
    const created = await db.$transaction(async (tx) => {
      const last = await tx.chapter.findFirst({
        where: { subjectId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      let nextOrder = (last?.order ?? -1) + 1;

      const ids: { id: string; name: string }[] = [];
      for (const chapter of chapters) {
        const createdChapter = await tx.chapter.create({
          data: {
            subjectId,
            name: chapter.name,
            description: null,
            order: nextOrder,
            difficulty: "Medium",
          },
          select: { id: true },
        });
        nextOrder += 1;
        ids.push({ id: createdChapter.id, name: chapter.name });

        for (const [ci, cn] of chapter.concepts.entries()) {
          const concept = await tx.concept.create({
            data: {
              chapterId: createdChapter.id,
              name: cn,
              difficulty: "Medium",
              order: ci,
              tags: [],
              learningObjectives: [],
            },
            select: { id: true },
          });

          await tx.conceptChecklist.createMany({
            data: CHECKLIST_ORDER.map((t, i) => ({
              conceptId: concept.id,
              userId,
              task: t.task,
              label: t.label,
              order: i,
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
      }

      return { chapters: ids, concepts: chapters.reduce((n, c) => n + c.concepts.length, 0) };
    });

    return Response.json({ ok: true, ...created });
  } catch (err) {
    console.error("syllabus/topics failed", err);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}