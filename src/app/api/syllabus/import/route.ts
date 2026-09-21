import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { persistRoadmap } from "@/lib/syllabus-actions";
import type { ParseOptions, RoadmapDraft } from "@/types/syllabus";

export const runtime = "nodejs";
export const maxDuration = 300;

// Import parity check: missing GROQ/R2 is fine here — a roadmap arrived at
// this point after a successful (previewed) parse.
export async function POST(req: Request) {
  const userId = await verifySession();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    roadmap?: RoadmapDraft;
    course?: string;
    pdfName?: string;
    fileKey?: string;
    keepPdf?: boolean;
    instructions?: string;
    options?: Partial<ParseOptions>;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const roadmap = body.roadmap;
  if (
    !roadmap ||
    !Array.isArray(roadmap.subjects) ||
    roadmap.subjects.length === 0
  ) {
    return Response.json({ error: "Empty roadmap" }, { status: 400 });
  }

  const opts = body.options ?? {};
  const generateChecklist = opts.generateChecklist ?? true;
  const generateRevisionSchedule = opts.generateRevisionSchedule ?? true;
  const estimateHours = opts.estimateHours ?? true;
  const learningObjectives = opts.learningObjectives ?? true;

  try {
    const summary = await persistRoadmap(userId, roadmap, {
      generateChecklist,
      generateRevisionSchedule,
      estimateHours,
      learningObjectives,
    });

    const record = await db.syllabusImport.create({
      data: {
        userId,
        course: body.course ?? roadmap.course ?? "Imported syllabus",
        pdfName: body.pdfName ?? null,
        fileKey: body.keepPdf ? (body.fileKey ?? null) : null,
        status: "COMPLETED",
        instructions: body.instructions ? String(body.instructions) : null,
        summary: summary as unknown as object,
        warnings: roadmap.warnings as unknown as object,
        completedAt: new Date(),
      },
    });

    return Response.json({ ok: true, summary, importId: record.id });
  } catch (err) {
    console.error("syllabus/import failed", err);
    return Response.json({ error: "Database error during import" }, { status: 500 });
  }
}