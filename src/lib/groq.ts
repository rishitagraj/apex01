import "server-only";
import type { ParseOptions, RoadmapDraft, ResourceDraft, ResourceKind } from "@/types/syllabus";

function normalizeResourceKind(kind: string): ResourceKind {
  const upper = kind.toUpperCase();
  const allowed: ResourceKind[] = ["PDF", "IMAGE", "MARKDOWN", "FORMULA", "DPP", "PYQ", "LINK", "YOUTUBE"];
  return allowed.includes(upper as ResourceKind) ? (upper as ResourceKind) : "LINK";
}

export class GroqNotConfiguredError extends Error {
  code = "NOT_CONFIGURED" as const;
  constructor() {
    super("GROQ_API_KEY is not configured");
  }
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are Apex Syllabus Parser. Convert educational syllabus documents into structured roadmap JSON.
Ignore headers, page numbers, indexes, logos and decorative content.
Detect: course, subjects, chapters, concepts, subconcepts, learning objectives, prerequisites, difficulty (Easy | Medium | Hard), estimated study hours, revision points, tags (NCERT, CBSE, Allen, JEE Main, JEE Advanced, NEET, Olympiad, Visual, Formula, Proof, Application).
Return valid JSON only — never markdown, never prose, no code fences.`;

function truncate(text: string, max = 110000): string {
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.8);
  const tail = max - head;
  return `${text.slice(0, head)}\n…[truncated]…\n${text.slice(-tail)}`;
}

function scrubJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function toOptionFlags(
  options: ParseOptions,
): Partial<Record<keyof ParseOptions, boolean | string>> {
  return {
    detectPrerequisites: options.detectPrerequisites
      ? "detect prerequisites between concepts"
      : "do not generate prerequisites",
    estimateHours: options.estimateHours
      ? "estimate study hours conservatively for every concept"
      : "do not estimate study hours",
    generateRevisionSchedule: options.generateRevisionSchedule
      ? "generate a revision plan (days: 2, 7, 14, 30) per concept"
      : "do not generate a revision plan",
    mergeDuplicates: options.mergeDuplicates
      ? "merge duplicate chapters and concepts"
      : "keep duplicates as-is",
    learningObjectives: options.learningObjectives
      ? "extract explicit learning objectives per concept"
      : "do not extract learning objectives",
    dependencyGraph: options.dependencyGraph
      ? "order concepts so their prerequisites can be derived"
      : "do not order by prerequisites",
    generateChecklist: true,
    keepPdf: undefined,
  };
}

export async function generateRoadmap(
  extractedText: string,
  instructions: string,
  options: ParseOptions,
): Promise<RoadmapDraft> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqNotConfiguredError();

  const flags = toOptionFlags(options);
  const userContent = [
    `USER IMPORT INSTRUCTIONS (must be obeyed):\n${instructions || "(none)"}`,
    `PARSER OPTIONS:\n${Object.entries(flags)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join("\n")}`,
    `SYLLABUS TEXT:\n${truncate(extractedText)}`,
  ].join("\n\n");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            "Return JSON shaped exactly like: {\"course\": string, \"subjects\": [{\"name\": string, \"classLevel\": string, \"examTags\": string[], \"chapters\": [{\"name\": string, \"description\": string, \"concepts\": [{\"name\": string, \"description\": string, \"difficulty\": \"Easy\" | \"Medium\" | \"Hard\", \"estimatedHours\": number, \"prerequisites\": string[], \"learningObjectives\": string[], \"tags\": string[]}]}]}], \"warnings\": string[], \"userInstructionsApplied\": string[]}." +
            `\n\n${userContent}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned no content");

  let parsed: unknown;
  try {
    parsed = JSON.parse(scrubJson(content));
  } catch {
    throw new Error("Malformed JSON from model; retry import");
  }
  return normalizeRoadmap(parsed);
}

/** Shape/defensive normalization + warnings for garbage the model may produce. */
function normalizeRoadmap(input: unknown): RoadmapDraft {
  if (!input || typeof input !== "object") {
    throw new Error("Model returned a non-object roadmap");
  }
  const raw = input as Record<string, unknown>;
  const warnings: string[] = [];
  const subjects = Array.isArray(raw.subjects) ? raw.subjects : [];

  const normSubjects = subjects
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => {
      const chapters = Array.isArray(s.chapters) ? s.chapters : [];
      return {
        name: String(s.name ?? "Untitled subject"),
        classLevel: s.classLevel == null ? null : String(s.classLevel),
        examTags: Array.isArray(s.examTags)
          ? (s.examTags as unknown[]).map(String)
          : [],
        chapters: chapters
          .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
          .map((c) => ({
            name: String(c.name ?? "Untitled chapter"),
            description:
              c.description == null ? null : String(c.description),
            concepts: (Array.isArray(c.concepts) ? c.concepts : [])
              .filter((co): co is Record<string, unknown> => !!co && typeof co === "object")
              .map((co) => ({
                name: String(co.name ?? "Untitled concept"),
                description:
                  co.description == null ? null : String(co.description),
                difficulty: ["Easy", "Medium", "Hard"].includes(String(co.difficulty))
                  ? String(co.difficulty)
                  : "Medium",
                estimatedHours:
                  typeof co.estimatedHours === "number"
                    ? Math.max(0.5, co.estimatedHours)
                    : null,
                prerequisites: Array.isArray(co.prerequisites)
                  ? (co.prerequisites as unknown[]).map(String)
                  : [],
                learningObjectives: Array.isArray(co.learningObjectives)
                  ? (co.learningObjectives as unknown[]).map(String)
                  : [],
                tags: Array.isArray(co.tags) ? (co.tags as unknown[]).map(String) : [],
                resources: Array.isArray(co.resources)
                  ? (co.resources as unknown[])
                      .filter((r): r is { kind?: unknown; title?: unknown; url?: unknown } =>
                        !!r && typeof r === "object",
                      )
                      .map(
                        (r): ResourceDraft => ({
                          kind: normalizeResourceKind(
                            typeof r.kind === "string" ? r.kind : "LINK",
                          ),
                          title: typeof r.title === "string" ? r.title : "Resource",
                          url: typeof r.url === "string" ? r.url : null,
                        }),
                      )
                  : [],
              })),
          })),
      };
    });

  if (subjects.length === 0) {
    warnings.push("No subjects detected — the document may be a scanned image.");
  }
  const chapterCount = normSubjects.reduce(
    (n, s) => n + s.chapters.length,
    0,
  );
  if (chapterCount === 0) {
    warnings.push("No chapters detected in the extracted text.");
  }

  const applied = Array.isArray(raw.userInstructionsApplied)
    ? (raw.userInstructionsApplied as unknown[]).map(String)
    : [];

  return {
    course: String(raw.course ?? "Imported syllabus"),
    subjects: normSubjects,
    warnings,
    userInstructionsApplied: applied,
  };
}