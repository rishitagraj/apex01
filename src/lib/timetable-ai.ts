import "server-only";
import { scrubJson } from "@/lib/groq";
import { WEEKDAYS } from "@/types/timetable";
import type {
  AiEngine,
  TimetableDraft,
  TimetableDraftDay,
  TimetableDraftSlot,
  TimetableGenerationResult,
  TimetableModelChoice,
  TimetableWizardInput,
} from "@/types/timetable";

export class TimetableAiNotConfiguredError extends Error {
  code = "AI_NOT_CONFIGURED" as const;
  constructor() {
    super("No AI engine is configured (set GEMINI_API_KEY or GROQ_API_KEY).");
  }
}

/** Internal: a failure that is worth retrying with the same engine but no JSON mode. */
class JsonModeError extends Error {
  retryWithoutJson = true;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are Apex Timetable Architect. You design realistic, achievable weekly study timetables for students.
Turn the student's routine and preferences into a complete, balanced timetable.

Rules:
- Use 24-hour HH:MM time only (e.g. "06:30", "16:00").
- Produce one entry per requested day, using the day names exactly as given.
- Cover the WHOLE day, not just studying: include fixed commitments (school/college, coaching/tuition, travel, meals, rest/sleep) AND study blocks. Label each slot clearly (e.g. "School", "Break", "Study — Physics", "Revision — Maths", "Sleep").
- Never invent facts the student did not give; when something is unknown, make a sensible assumption and list it in "assumptions".
- Within a day, slots must be ordered, non-overlapping, and sit inside the student's wake-to-sleep window.
- Prefer 30–90 minute study blocks with short 10–15 minute breaks between them.
- Distribute the student's prioritised subjects across the week (space them out; don't stack one subject all day).
- Respect the target study hours per day; do not schedule more studying than that.
- Keep it practical: include at least one revision block on most study days.
- Be concise. Return valid JSON only — no markdown, no prose, no code fences.`;

const SCHEMA_HINT =
  'Return JSON shaped exactly like: {"summary": string, "assumptions": string[], "days": [{"name": string, "slots": [{"subject": string, "startAt": "HH:MM", "endAt": "HH:MM", "notes": string}]}]}. Include every day requested. Keep "summary" under 60 words and each note under 12 words.';

function orNone(value: string): string {
  return value && value.trim() ? value.trim() : "(not provided)";
}

function buildUserContent(input: TimetableWizardInput): string {
  const days = input.days.length ? input.days.join(", ") : WEEKDAYS.join(", ");
  return [
    `Wake-up time: ${orNone(input.wakeTime)}`,
    `Sleep time: ${orNone(input.sleepTime)}`,
    `School/college starts: ${orNone(input.schoolStart)}`,
    `School/college ends: ${orNone(input.schoolEnd)}`,
    `Usually reaches home: ${orNone(input.homeTime)}`,
    `Days to plan: ${days}`,
    `Fixed commitments (coaching/tuition/sports/other): ${orNone(input.coaching)}`,
    `Target study hours per day: ${input.studyHours ?? "(unspecified)"}`,
    `Subjects/topics to prioritise: ${
      input.priorities.length ? input.priorities.join(", ") : "(none specified)"
    }`,
    `Additional notes: ${orNone(input.extra)}`,
    "",
    "STUDENT'S OWN DESCRIPTION OF AN AVERAGE DAY (treat as the highest-priority source of truth):",
    orNone(input.description),
  ].join("\n");
}

function normalizeSlot(raw: Record<string, unknown>): TimetableDraftSlot | null {
  const subject = String(raw.subject ?? "").trim().slice(0, 120);
  const startAt = String(raw.startAt ?? "").trim();
  const endAt = String(raw.endAt ?? "").trim();
  if (!subject) return null;
  if (!TIME.test(startAt) || !TIME.test(endAt)) return null;
  if (endAt <= startAt) return null;
  const notes = raw.notes == null ? "" : String(raw.notes).trim().slice(0, 1000);
  return { subject, startAt, endAt, notes };
}

/** Defensive normalization: drops anything malformed instead of trusting the model. */
export function normalizeTimetableDraft(input: unknown): TimetableDraft {
  if (!input || typeof input !== "object") {
    throw new Error("The AI returned an unusable timetable. Please try again.");
  }
  const raw = input as Record<string, unknown>;
  const rawDays = Array.isArray(raw.days) ? raw.days : [];

  const days: TimetableDraftDay[] = [];
  for (const day of rawDays.slice(0, 10)) {
    if (!day || typeof day !== "object") continue;
    const d = day as Record<string, unknown>;
    const name = String(d.name ?? "").trim().slice(0, 60) || "Day";
    const rawSlots = Array.isArray(d.slots) ? d.slots : [];
    const slots = rawSlots
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map(normalizeSlot)
      .filter((s): s is TimetableDraftSlot => s !== null)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 40);
    if (slots.length > 0) days.push({ name, slots });
  }

  if (days.length === 0) {
    throw new Error(
      "The AI couldn't build a usable timetable. Add a little more detail (e.g. your school timings) and try again.",
    );
  }

  const summary = String(raw.summary ?? "").trim().slice(0, 600);
  const assumptions = Array.isArray(raw.assumptions)
    ? (raw.assumptions as unknown[])
        .map((a) => String(a ?? "").trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 10)
    : [];

  return { summary, assumptions, days };
}

interface EngineTarget {
  engine: AiEngine;
  key: string;
  model: string;
  maxTokens: number;
}

const GEMINI_DEFAULT_MODEL = "gemini-3.6-flash";
const GROQ_MODEL = "openai/gpt-oss-20b";

/** Turns the user's model choice into the concrete provider request(s) to try. */
function buildTargets(choice: TimetableModelChoice): EngineTarget[] {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (choice === "auto") {
    const out: EngineTarget[] = [];
    if (geminiKey) {
      out.push({
        engine: "gemini",
        key: geminiKey,
        model: process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
        maxTokens: 8192,
      });
    }
    if (groqKey) {
      out.push({
        engine: "groq",
        key: groqKey,
        model: GROQ_MODEL,
        maxTokens: 4096,
      });
    }
    if (out.length === 0) throw new TimetableAiNotConfiguredError();
    return out;
  }

  if (choice === GROQ_MODEL) {
    if (!groqKey) throw new TimetableAiNotConfiguredError();
    return [{ engine: "groq", key: groqKey, model: GROQ_MODEL, maxTokens: 4096 }];
  }

  if (!geminiKey) throw new TimetableAiNotConfiguredError();
  return [{ engine: "gemini", key: geminiKey, model: choice, maxTokens: 8192 }];
}

/**
 * Builds a timetable draft. `model` lets the user pin a specific engine/model;
 * "auto" uses Gemini first and falls back to Groq on any failure.
 */
export async function generateTimetableDraft(
  input: TimetableWizardInput,
  model: TimetableModelChoice = "auto",
): Promise<TimetableGenerationResult> {
  const targets = buildTargets(model);

  // For each target: try strict JSON mode first. Only if that specific failure
  // looks like a JSON-validation / empty-output problem do we retry the same
  // target without JSON mode (some reasoning models fail JSON mode this way).
  // Other failures (503/429/network) move straight to the next target so we
  // never burn the whole function timeout on a provider that is simply down.
  let lastError: unknown = null;
  for (const target of targets) {
    try {
      const draft = await requestDraft(target, input, true);
      return { draft, engine: target.engine, model: target.model };
    } catch (err) {
      lastError = err;
      if (err instanceof JsonModeError) {
        try {
          const draft = await requestDraft(target, input, false);
          return { draft, engine: target.engine, model: target.model };
        } catch (retryErr) {
          lastError = retryErr;
        }
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("The AI planner is unavailable right now. Please try again.");
}

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;

/** Groq free tier is token-per-minute limited; parse its "try again in Ns" hint. */
function retryDelayMs(res: Response, detail: string): number | null {
  const header = Number(res.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, 18000);
  const match = detail.match(/try again in ([\d.]+)\s*s/i);
  if (match) return Math.min(Number(match[1]) * 1000 + 500, 18000);
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestDraft(
  target: EngineTarget,
  input: TimetableWizardInput,
  jsonMode: boolean,
): Promise<TimetableDraft> {
  const { engine, key: apiKey, model, maxTokens } = target;
  const url = engine === "gemini" ? GEMINI_URL : GROQ_URL;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          temperature: 0.4,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `${SCHEMA_HINT}\n\n${buildUserContent(input)}`,
            },
          ],
        }),
      });
    } catch (err) {
      const name = (err as Error)?.name;
      const aborted = name === "TimeoutError" || name === "AbortError";
      throw new Error(
        aborted
          ? "The AI planner took too long to respond. Please try again."
          : "Couldn't reach the AI planner. Check your connection and try again.",
      );
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");

      // Transient rate limits: wait for the provider's suggested delay and retry.
      // (Other errors, e.g. Gemini 503 high-demand, fall through to the next engine.)
      if (res.status === 429 && attempt < MAX_ATTEMPTS) {
        const wait = retryDelayMs(res, detail) ?? attempt * 2000;
        await sleep(wait);
        continue;
      }

      // Groq (and some reasoning models) can reject JSON mode with an empty
      // generation — worth one retry without JSON mode.
      if (jsonMode && /json_validate_failed|Failed to validate JSON/i.test(detail)) {
        throw new JsonModeError("JSON mode validation failed");
      }

      if (res.status === 429) {
        throw new Error(
          "The AI planner is getting a lot of requests right now. Please wait a moment and try again.",
        );
      }

      throw new Error(
        `The AI planner request failed (${res.status}): ${detail.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string; reasoning?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      // Empty content under JSON mode is the classic reasoning-model failure.
      if (jsonMode) throw new JsonModeError("JSON mode returned empty content");
      throw new Error("The AI returned an empty response. Please try again.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(scrubJson(content));
    } catch {
      if (jsonMode) throw new JsonModeError("JSON mode returned malformed JSON");
      throw new Error("The AI returned malformed JSON. Please try again.");
    }

    return normalizeTimetableDraft(parsed);
  }

  throw new Error(
    "The AI planner is busy right now. Please try again in a moment.",
  );
}
