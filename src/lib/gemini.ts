import "server-only";
import type { ParseOptions, RoadmapDraft } from "@/types/syllabus";
import {
  ROADMAP_SCHEMA_HINT,
  SYSTEM_PROMPT,
  buildParserUserContent,
  normalizeRoadmap,
  scrubJson,
} from "@/lib/groq";

export class GeminiNotConfiguredError extends Error {
  code = "NOT_CONFIGURED" as const;
  constructor() {
    super("GEMINI_API_KEY is not configured");
  }
}

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/**
 * Gemini has a ~1M-token context, so no truncation is needed — the full
 * extracted text (already capped at ~200k chars by the PDF parser) is sent
 * verbatim. Larger output budget reduces mid-roadmap cut-offs.
 */
export async function generateWithGemini(
  extractedText: string,
  instructions: string,
  options: ParseOptions,
): Promise<RoadmapDraft> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const userContent = buildParserUserContent(extractedText, instructions, options, 0);

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: ROADMAP_SCHEMA_HINT + `\n\n${userContent}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Gemini request failed (${res.status}): ${detail.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Gemini returned no content");

  let parsed: unknown;
  try {
    parsed = JSON.parse(scrubJson(content));
  } catch {
    throw new Error("Malformed JSON from model; retry import");
  }
  return normalizeRoadmap(parsed);
}