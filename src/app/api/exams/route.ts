import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { examSchema } from "@/lib/validation";
import {
  deriveExamSubjectIds,
  loadExamDetail,
  loadExams,
  resolveOwnedScope,
} from "@/lib/exams";

export const runtime = "nodejs";

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export async function GET() {
  const userId = await verifySession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exams = await loadExams(userId);
  return NextResponse.json({ exams });
}

export async function POST(request: Request) {
  const userId = await verifySession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const owned = await resolveOwnedScope(userId, { subjectIds, chapterIds, conceptIds });
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: 400 });

  const duplicate = await db.exam.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" }, date: toDate(date) },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "An exam with this name and date already exists." },
      { status: 409 },
    );
  }

  const uniqueSubjects = await deriveExamSubjectIds(subjectIds, chapterIds, conceptIds);

  const created = await db.exam.create({
    data: {
      userId,
      name,
      date: toDate(date),
      time: time ? time : null,
      type,
      classLevel: classLevel ? classLevel : null,
      notes: notes ? notes : null,
      subjects: { create: uniqueSubjects.map((subjectId) => ({ subjectId })) },
      chapters: {
        create: [...new Set(chapterIds)].map((chapterId) => ({ chapterId })),
      },
      concepts: {
        create: [...new Set(conceptIds)].map((conceptId) => ({ conceptId })),
      },
    },
    select: { id: true },
  });

  const exam = await loadExamDetail(userId, created.id);
  return NextResponse.json({ exam }, { status: 201 });
}
