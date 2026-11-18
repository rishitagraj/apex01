import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { loadExamDetail, loadExams } from "@/lib/exams";
import {
  buildExamPrepPlan,
  type PlanConceptEntry,
  type PlanTodoEntry,
} from "@/utils/exams";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function buildPlanFor(userId: string, examId: string) {
  const detail = await loadExamDetail(userId, examId);
  if (!detail) return null;

  const [todos, settings, exams] = await Promise.all([
    db.todo.findMany({
      where: { userId },
      select: { title: true, notes: true, completed: true, dueDate: true },
    }),
    db.userSyllabusSettings.findUnique({
      where: { userId },
      select: { weeklyTargetHours: true },
    }),
    loadExams(userId),
  ]);

  const entries: PlanConceptEntry[] = detail.chapterProgress.flatMap((ch) =>
    ch.concepts.map((concept) => ({
      concept,
      subjectId: ch.subjectId,
      subjectName: ch.subjectName,
      chapterId: ch.id,
      chapterName: ch.name,
    })),
  );

  const todoEntries: PlanTodoEntry[] = todos.map((t) => ({
    title: t.title,
    notes: t.notes,
    completed: t.completed,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
  }));

  const competingExams = exams
    .filter((e) => e.id !== examId && e.status === "upcoming")
    .map((e) => ({ name: e.name, date: e.date }));

  return buildExamPrepPlan({
    examId,
    examName: detail.name,
    examDate: detail.date,
    entries,
    todos: todoEntries,
    weeklyTargetHours: settings?.weeklyTargetHours ?? 20,
    competingExams,
  });
}

export async function GET(_request: Request, ctx: Ctx) {
  const userId = await verifySession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const plan = await buildPlanFor(userId, id);
  if (!plan) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  return NextResponse.json({ plan });
}

export async function POST(_request: Request, ctx: Ctx) {
  const userId = await verifySession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const plan = await buildPlanFor(userId, id);
  if (!plan) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  if (plan.tasks.length === 0) {
    return NextResponse.json({ created: 0, plan });
  }

  const created = await db.todo.createMany({
    data: plan.tasks.map((t) => ({
      userId,
      title: t.title,
      notes: t.notes,
      priority: t.priority,
      dueDate: new Date(`${t.dueDate}T00:00:00.000Z`),
    })),
  });

  return NextResponse.json({ created: created.count, plan });
}
