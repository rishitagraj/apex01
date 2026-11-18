import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { examSchema } from "@/lib/validation";
import {
  deriveExamSubjectIds,
  loadExamDetail,
  resolveOwnedScope,
} from "@/lib/exams";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export async function GET(_request: Request, ctx: Ctx) {
  const userId = await verifySession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const exam = await loadExamDetail(userId, id);
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  return NextResponse.json({ exam });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const userId = await verifySession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const owned = await db.exam.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = examSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, date, time, type, classLevel, notes, subjectIds, chapterIds, conceptIds } =
    parsed.data;

  const scopeOk = await resolveOwnedScope(userId, { subjectIds, chapterIds, conceptIds });
  if (!scopeOk.ok) return NextResponse.json({ error: scopeOk.error }, { status: 400 });

  const duplicate = await db.exam.findFirst({
    where: {
      userId,
      id: { not: id },
      name: { equals: name, mode: "insensitive" },
      date: toDate(date),
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "Another exam with this name and date already exists." },
      { status: 409 },
    );
  }

  const uniqueSubjects = await deriveExamSubjectIds(subjectIds, chapterIds, conceptIds);

  await db.$transaction(async (tx) => {
    await tx.exam.update({
      where: { id },
      data: {
        name,
        date: toDate(date),
        time: time ? time : null,
        type,
        classLevel: classLevel ? classLevel : null,
        notes: notes ? notes : null,
      },
    });
    await Promise.all([
      tx.examSubject.deleteMany({ where: { examId: id } }),
      tx.examChapter.deleteMany({ where: { examId: id } }),
      tx.examConcept.deleteMany({ where: { examId: id } }),
    ]);
    if (uniqueSubjects.length > 0) {
      await tx.examSubject.createMany({
        data: uniqueSubjects.map((subjectId) => ({ examId: id, subjectId })),
      });
    }
    if (chapterIds.length > 0) {
      await tx.examChapter.createMany({
        data: [...new Set(chapterIds)].map((chapterId) => ({ examId: id, chapterId })),
      });
    }
    if (conceptIds.length > 0) {
      await tx.examConcept.createMany({
        data: [...new Set(conceptIds)].map((conceptId) => ({ examId: id, conceptId })),
      });
    }
  });

  const exam = await loadExamDetail(userId, id);
  return NextResponse.json({ exam });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const userId = await verifySession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const owned = await db.exam.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  await db.exam.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
