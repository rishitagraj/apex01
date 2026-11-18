import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { examAttemptSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const userId = await verifySession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const owned = await db.exam.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = examAttemptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const subjectMarks = (d.subjectMarks ?? []).filter(
    (s) => s.marks != null || s.maxMarks != null,
  );

  const attempt = await db.examAttempt.create({
    data: {
      examId: id,
      attemptDate: new Date(`${d.attemptDate}T00:00:00.000Z`),
      marks: d.marks ?? null,
      maxMarks: d.maxMarks ?? null,
      subjectMarks: subjectMarks.length > 0 ? subjectMarks : undefined,
      weakTopics: d.weakTopics ? d.weakTopics : null,
      mistakes: d.mistakes ? d.mistakes : null,
      reflections: d.reflections ? d.reflections : null,
    },
  });

  return NextResponse.json({ attempt }, { status: 201 });
}
