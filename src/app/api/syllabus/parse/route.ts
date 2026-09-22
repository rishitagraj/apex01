import { verifySession } from "@/lib/auth";
import { GroqNotConfiguredError, generateRoadmap } from "@/lib/groq";
import { extractPdfText, ScannedPdfError, UnsupportedPdfError } from "@/lib/parser";
import {
  B2_BUCKET,
  deleteObject,
  getObjectBuffer,
  newFileKey,
  presignUpload,
} from "@/lib/b2";
import { DEFAULT_PARSE_OPTIONS, type ParseOptions } from "@/types/syllabus";

export const runtime = "nodejs";
export const maxDuration = 300;

function readOptions(input: unknown): ParseOptions {
  if (!input || typeof input !== "object") return { ...DEFAULT_PARSE_OPTIONS };
  const raw = input as Record<string, boolean | undefined>;
  return {
    detectPrerequisites: raw.detectPrerequisites ?? DEFAULT_PARSE_OPTIONS.detectPrerequisites,
    estimateHours: raw.estimateHours ?? DEFAULT_PARSE_OPTIONS.estimateHours,
    generateRevisionSchedule:
      raw.generateRevisionSchedule ?? DEFAULT_PARSE_OPTIONS.generateRevisionSchedule,
    generateChecklist: raw.generateChecklist ?? DEFAULT_PARSE_OPTIONS.generateChecklist,
    mergeDuplicates: raw.mergeDuplicates ?? DEFAULT_PARSE_OPTIONS.mergeDuplicates,
    learningObjectives:
      raw.learningObjectives ?? DEFAULT_PARSE_OPTIONS.learningObjectives,
    dependencyGraph: raw.dependencyGraph ?? DEFAULT_PARSE_OPTIONS.dependencyGraph,
    keepPdf: raw.keepPdf ?? false,
  };
}

// Two-step flow:
//   POST {"action":"presign", fileName, contentType, fileSize} → { uploadUrl, fileKey }
//   POST {"action":"process", fileKey, instructions, options}   → { roadmap, textPreview, needsOcr }
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

  if (action === "presign") {
    const fileName = String(body.fileName ?? "syllabus.pdf");
    const contentType = String(body.contentType ?? "application/pdf");
    const fileSize = Number(body.fileSize ?? 0);
    try {
      const fileKey = newFileKey(fileName);
      const uploadUrl = await presignUpload(fileKey, contentType, fileSize);
      return Response.json({ ok: true, uploadUrl, fileKey });
    } catch (err) {
      const code = (err as { code?: string }).code ?? "B2_ERROR";
      if (code === "NOT_CONFIGURED") {
        return Response.json(
          {
            error: "Backblaze B2 is not configured. Set B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET.",
            code,
          },
          { status: 503 },
        );
      }
      return Response.json({ error: String((err as Error)?.message ?? err), code }, { status: 400 });
    }
  }

  if (action === "process") {
    const fileKey = String(body.fileKey ?? "");
    const instructions = String(body.instructions ?? "");
    const options = readOptions(body.options);
    if (!fileKey) return Response.json({ error: "fileKey required" }, { status: 400 });

    try {
      const buffer = await getObjectBuffer(fileKey);
      const parsed = await extractPdfText(buffer);

      if (parsed.needsOcr) {
        return Response.json(
          {
            error:
              "No selectable text detected in the PDF (looks like a scanned document). OCR is not yet backed by a vision model — try a text-based PDF or a typed syllabus.",
            needsOcr: true,
            code: "NEEDS_OCR",
          },
          { status: 422 },
        );
      }

      const roadmap = await generateRoadmap(parsed.text, instructions, options);
      // Success: drop the temp object unless the user asked to keep the PDF.
      await cleanup(fileKey, options);

      return Response.json({
        ok: true,
        roadmap,
        textPreview: parsed.text.slice(0, 2400),
        pages: parsed.pages,
        textChars: parsed.text.length,
      });
    } catch (err) {
      // Keep the temp object on failure so "retry without re-upload" works;
      // stale keys are aged out by the bucket lifecycle rule.
      if (err instanceof GroqNotConfiguredError) {
        return Response.json(
          {
            error: "Groq is not configured. Add GROQ_API_KEY to generate AI roadmaps.",
            code: "NOT_CONFIGURED",
          },
          { status: 503 },
        );
      }
      if (err instanceof UnsupportedPdfError) {
        return Response.json({ error: err.message, code: "UNSUPPORTED_PDF" }, { status: 422 });
      }
      if (err instanceof ScannedPdfError) {
        return Response.json({ error: err.message, code: "NEEDS_OCR" }, { status: 422 });
      }
      const isNoSuchKey =
        err &&
        (err as { name?: string; code?: string }).name === "NoSuchKey" ||
        (err as { code?: string }).code === "NoSuchKey";
      const detail = isNoSuchKey
        ? "Your upload was cleaned up before processing. Please upload the PDF again."
        : String((err as Error)?.message ?? err);
      return Response.json({ error: detail, code: "PARSE_ERROR" }, { status: 500 });
    }
  }

  return Response.json(
    {
      error: `Unknown action: ${action}. ${B2_BUCKET} requires a bucket lifecycle rule + CORS config allowing PUT to the syllabus-pdfs/ prefix.`,
    },
    { status: 400 },
  );
}

async function cleanup(fileKey: string, options?: ParseOptions) {
  if (options?.keepPdf) return;
  try {
    await deleteObject(fileKey);
  } catch {
    // best-effort: leftover temp objects are aged out of the bucket policy
  }
}