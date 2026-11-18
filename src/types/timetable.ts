export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type AiEngine = "gemini" | "groq";

/** Model picker choices for the AI timetable planner. */
export const TIMETABLE_MODEL_IDS = [
  "auto",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.8-flash",
  "openai/gpt-oss-20b",
] as const;

export type TimetableModelChoice = (typeof TIMETABLE_MODEL_IDS)[number];

export interface TimetableModelOption {
  id: TimetableModelChoice;
  label: string;
  hint: string;
  /** null means "pick the best configured engine". */
  engine: AiEngine | null;
}

export const TIMETABLE_MODEL_OPTIONS: TimetableModelOption[] = [
  {
    id: "auto",
    label: "Auto",
    hint: "Gemini first, falls back to Groq",
    engine: null,
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    hint: "Fast · default",
    engine: "gemini",
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    hint: "Fast, well-rounded",
    engine: "gemini",
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash Lite",
    hint: "Lightest & quickest",
    engine: "gemini",
  },
  {
    id: "gemini-flash-lite-latest",
    label: "Gemini Flash Lite",
    hint: "Always-current lite tier",
    engine: "gemini",
  },
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    hint: "Newest · may be busy",
    engine: "gemini",
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    hint: "Groq · very fast inference",
    engine: "groq",
  },
];

/** A generated slot before it is persisted. */
export interface TimetableDraftSlot {
  subject: string;
  /** 24-hour HH:MM */
  startAt: string;
  /** 24-hour HH:MM */
  endAt: string;
  notes: string;
}

export interface TimetableDraftDay {
  name: string;
  slots: TimetableDraftSlot[];
}

export interface TimetableDraft {
  summary: string;
  assumptions: string[];
  days: TimetableDraftDay[];
}

/** Everything the user tells the AI planner (all optional — the more, the better). */
export interface TimetableWizardInput {
  wakeTime: string;
  sleepTime: string;
  schoolStart: string;
  schoolEnd: string;
  homeTime: string;
  days: string[];
  coaching: string;
  studyHours: number | null;
  priorities: string[];
  description: string;
  extra: string;
}

export interface TimetableGenerationResult {
  draft: TimetableDraft;
  engine: AiEngine;
  /** The concrete model id that produced the draft. */
  model: string;
}

/** Persisted row shapes (mirror the /api/timetable GET response). */
export interface TimetableSlotRow {
  id: string;
  subject: string;
  startAt: string;
  endAt: string;
  notes: string | null;
  sortOrder: number;
}

export interface TimetableDayRow {
  id: string;
  name: string;
  sortOrder: number;
  slots: TimetableSlotRow[];
}
