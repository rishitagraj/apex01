import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { EXAM_TAGS } from "@/types/syllabus";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await verifySession();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { examTags?: string[]; autoRevisionDays?: number; weeklyTargetHours?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validTags = new Set<string>(EXAM_TAGS);
  const examTags = (body.examTags ?? [])
    .filter((t): t is string => validTags.has(t))
    .slice(0, 12);

  const autoRevisionDays = Math.max(1, Math.min(60, Number(body.autoRevisionDays) || 7));
  const weeklyTargetHours = Math.max(1, Math.min(120, Number(body.weeklyTargetHours) || 20));

  try {
    const settings = await db.userSyllabusSettings.upsert({
      where: { userId },
      create: {
        userId,
        examTags,
        autoRevisionDays,
        weeklyTargetHours,
      },
      update: { examTags, autoRevisionDays, weeklyTargetHours },
      select: { examTags: true, autoRevisionDays: true, weeklyTargetHours: true },
    });
    return Response.json({ ok: true, settings });
  } catch (err) {
    console.error("syllabus/settings failed", err);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}