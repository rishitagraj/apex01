import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Deletes a concept, chapter or subject tree. Concepts cascade their progress,
// checklists, resources, revisions, dependencies, notes, mistakes and revision
// schedules via the schema's onDelete: Cascade.
export async function POST(req: Request) {
  const userId = await verifySession();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { scope?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { scope, id } = body;
  if (!scope || !id) {
    return Response.json({ error: "scope and id required" }, { status: 400 });
  }

  try {
    switch (scope) {
      case "concept": {
        const owned = await db.concept.findFirst({
          where: { id, chapter: { subject: { userId } } },
          select: { id: true },
        });
        if (!owned) return Response.json({ error: "Not found" }, { status: 404 });
        await db.concept.delete({ where: { id } });
        return Response.json({ ok: true, deleted: id });
      }

      case "chapter": {
        const owned = await db.chapter.findFirst({
          where: { id, subject: { userId } },
          select: { id: true },
        });
        if (!owned) return Response.json({ error: "Not found" }, { status: 404 });
        await db.chapter.delete({ where: { id } });
        return Response.json({ ok: true, deleted: id });
      }

      case "subject": {
        const owned = await db.subject.findFirst({
          where: { id, userId },
          select: { id: true },
        });
        if (!owned) return Response.json({ error: "Not found" }, { status: 404 });
        const chapters = await db.chapter.findMany({
          where: { subjectId: id },
          select: { id: true },
        });
        await db.concept.deleteMany({
          where: { chapter: { subjectId: id } },
        });
        await db.chapter.deleteMany({ where: { subjectId: id } });
        await db.subject.delete({ where: { id } });
        return Response.json({ ok: true, deleted: id, chapters: chapters.length });
      }

      case "import": {
        const owned = await db.syllabusImport.findFirst({
          where: { id, userId },
          select: { id: true },
        });
        if (!owned) return Response.json({ error: "Not found" }, { status: 404 });
        await db.syllabusImport.delete({ where: { id } });
        return Response.json({ ok: true, deleted: id });
      }

      default:
        return Response.json({ error: `Unknown scope: ${scope}` }, { status: 400 });
    }
  } catch (err) {
    console.error("syllabus/delete failed", err);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}