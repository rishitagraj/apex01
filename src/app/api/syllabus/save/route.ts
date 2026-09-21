import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  findOwnedConcept,
  recomputeAndPersist,
} from "@/lib/syllabus-actions";
import type { ChecklistTask } from "@/types/syllabus";

export const runtime = "nodejs";

// Mutations powering the concept drawer + dashboard quick actions. Every
// mutation is user-scoped; coverage/status re-derive automatically so the UI
// always reflects the mastery model.
export async function POST(req: Request) {
  const userId = await verifySession();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action as string | undefined;
  const conceptId = body.conceptId as string | undefined;
  if (!action || !conceptId) {
    return Response.json({ error: "action and conceptId required" }, { status: 400 });
  }

  const concept = await findOwnedConcept(conceptId, userId);
  if (!concept) {
    return Response.json({ error: "Concept not found" }, { status: 404 });
  }

  try {
    switch (action) {
      case "checklist": {
        const task = body.task as ChecklistTask | undefined;
        const done = Boolean(body.done);
        if (!task) return Response.json({ error: "task required" }, { status: 400 });

        await db.conceptChecklist.upsert({
          where: { conceptId_userId_task: { conceptId, userId, task } },
          create: { conceptId, userId, task, done },
          update: { done },
        });

        const progress = await recomputeAndPersist(conceptId, userId);
        const updated = await db.conceptChecklist.findMany({
          where: { conceptId, userId },
          select: { task: true, done: true },
        });
        return Response.json({
          ok: true,
          coverage: progress.coverage,
          status: progress.status,
          checklist: updated,
        });
      }

      case "confidence": {
        const confidence = Math.max(0, Math.min(100, Number(body.confidence) || 0));
        const progress = await db.userConceptProgress.upsert({
          where: { conceptId_userId: { conceptId, userId } },
          create: {
            conceptId,
            userId,
            confidence,
            lastStudiedAt: new Date(),
          },
          update: { confidence, lastStudiedAt: new Date() },
        });
        const outcome = await recomputeAndPersist(conceptId, userId);
        return Response.json({
          ok: true,
          coverage: outcome.coverage,
          status: outcome.status,
          confidence: progress.confidence,
        });
      }

      case "notes": {
        const notes = String(body.notes ?? "");
        await db.conceptNote.upsert({
          where: { conceptId_userId: { conceptId, userId } },
          create: { conceptId, userId, body: notes },
          update: { body: notes },
        });
        return Response.json({ ok: true });
      }

      case "revise": {
        const kind = (body.kind as string) || "MANUAL";
        const revision = await db.conceptRevision.create({
          data: {
            conceptId,
            userId,
            kind: kind as "MANUAL",
            note: body.note ? String(body.note) : null,
          },
        });
        await db.userConceptProgress.updateMany({
          where: { conceptId, userId },
          data: { lastRevisedAt: new Date(), needsRevision: false },
        });
        const outcome = await recomputeAndPersist(conceptId, userId);
        return Response.json({
          ok: true,
          revision,
          coverage: outcome.coverage,
          status: outcome.status,
        });
      }

      case "toggleRevisionFlag": {
        const needsRevision = Boolean(body.needsRevision);
        await db.userConceptProgress.updateMany({
          where: { conceptId, userId },
          data: { needsRevision },
        });
        const outcome = await recomputeAndPersist(conceptId, userId);
        return Response.json({
          ok: true,
          coverage: outcome.coverage,
          status: outcome.status,
        });
      }

      case "mistake": {
        const text = String(body.text ?? "").trim();
        if (!text) return Response.json({ error: "text required" }, { status: 400 });
        const mistake = await db.conceptMistake.create({
          data: {
            conceptId,
            userId,
            text,
            source: body.source ? String(body.source) : null,
          },
        });
        return Response.json({ ok: true, mistake });
      }

      case "favouriteResource": {
        const resourceId = String(body.resourceId ?? "");
        if (!resourceId) {
          return Response.json({ error: "resourceId required" }, { status: 400 });
        }
        const owned = await db.conceptResource.findFirst({
          where: { id: resourceId, conceptId, userId },
          select: { id: true },
        });
        if (!owned) return Response.json({ error: "Not found" }, { status: 404 });
        const resource = await db.conceptResource.update({
          where: { id: resourceId },
          data: { favourite: Boolean(body.favourite) },
        });
        return Response.json({ ok: true, favourite: resource.favourite });
      }

      case "studyMinutes": {
        const minutes = Math.max(0, Number(body.minutes) || 0);
        await db.userConceptProgress.upsert({
          where: { conceptId_userId: { conceptId, userId } },
          create: { conceptId, userId, studyMinutes: minutes, lastStudiedAt: new Date() },
          update: { studyMinutes: { increment: minutes }, lastStudiedAt: new Date() },
        });
        const outcome = await recomputeAndPersist(conceptId, userId);
        return Response.json({
          ok: true,
          coverage: outcome.coverage,
          status: outcome.status,
        });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("syllabus/save failed", err);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}