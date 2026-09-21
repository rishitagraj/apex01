"use client";

import { useId } from "react";

export interface PromptTemplate {
  name: string;
  prompt: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    name: "CBSE Only",
    prompt:
      "Import only CBSE-aligned topics. Keep only NCERT topics and NCERT exercise names. Ignore sample papers.",
  },
  {
    name: "JEE Foundation",
    prompt:
      "Build a JEE Foundation roadmap: emphasise NCERT basics first, then add problem-solving chapters. Tag application-heavy chapters as Application.",
  },
  {
    name: "JEE Main",
    prompt:
      "Import only JEE Main relevant chapters. Tag high-frequency chapters as JEE Main. Estimate study hours conservatively.",
  },
  {
    name: "NEET",
    prompt:
      "Import only NEET relevant chapters from Biology, Chemistry, Physics. Ignore engineering-only topics like Coordinate Geometry depth.",
  },
  {
    name: "Olympiad",
    prompt:
      "Focus on Olympiad-level chapters. Tag proof-heavy concepts as Proof and visual ones as Visual. Include advanced concepts beyond NCERT.",
  },
];

const MAX_LEN = 1200;

export function PromptBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="mr-1 text-xs font-medium uppercase tracking-wide text-muted">
          AI Import Instructions
        </p>
        {PROMPT_TEMPLATES.map((t) => (
          <button
            key={t.name}
            onClick={() => onChange(t.prompt)}
            className={`chip border-line bg-surface text-[11px] text-muted transition hover:border-apex/40 hover:text-apex ${value === t.prompt ? "border-apex/50 bg-apex/10 text-apex" : ""}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_LEN))}
        placeholder={
          'e.g. "Import only Mathematics chapters 5–10. Merge duplicate chapters. Rename Coordinate Geometry to Coordinates. Tag geometry concepts as Visual. Keep only NCERT topics. Ignore sample papers."'
        }
        rows={3}
        maxLength={MAX_LEN}
        aria-label="AI import instructions"
        className="input w-full resize-y leading-relaxed"
      />
      <div className="flex justify-end">
        <span
          className={`text-[10px] tabular-nums ${
            value.length > MAX_LEN * 0.9 ? "text-amber-300" : "text-muted"
          }`}
        >
          {value.length}/{MAX_LEN}
        </span>
      </div>
    </div>
  );
}