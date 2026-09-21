"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Layers, RefreshCw } from "lucide-react";
import type { ConceptVM } from "@/types/syllabus";
import { ConceptCard } from "@/components/syllabus/ConceptCard";

function difficultySpread(concepts: ConceptVM[]): {
  easy: number;
  medium: number;
  hard: number;
} {
  let easy = 0;
  let medium = 0;
  let hard = 0;
  for (const c of concepts) {
    const key = c.difficulty.toLowerCase();
    if (key.includes("easy")) easy += 1;
    else if (key.includes("hard") || key.includes("advanced") || key.includes("difficult")) hard += 1;
    else medium += 1;
  }
  return { easy, medium, hard };
}

export function ChapterCard({
  chapter,
  expanded,
  onToggle,
  onOpenConcept,
  onQuickRevise,
  onToggleRevisionFlag,
}: {
  chapter: {
    id: string;
    name: string;
    description: string | null;
    coverage: number;
    conceptCount: number;
    completedCount: number;
    revisionDue: number;
    resources: number;
    concepts: ConceptVM[];
  };
  expanded: boolean;
  onToggle: () => void;
  onOpenConcept: (concept: ConceptVM) => void;
  onQuickRevise: (concept: ConceptVM) => void;
  onToggleRevisionFlag: (concept: ConceptVM) => void;
}) {
  const reduced = useReducedMotion();
  const spread = difficultySpread(chapter.concepts);

  return (
    <motion.div
      layout={!reduced}
      className="card overflow-hidden rounded-3xl">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`chapter-${chapter.id}`}
        className="w-full px-4 py-4 text-left transition hover:bg-white/[0.02] sm:px-5"
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-apex-gradient text-white shadow-lg shadow-apex/20 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          >
            <ChevronDown size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold">{chapter.name}</h3>
              {chapter.revisionDue > 0 ? (
                <span className="chip border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-300">
                  <RefreshCw size={11} className="mr-1 inline -scale-x-100" />
                  {chapter.revisionDue} due
                </span>
              ) : null}
              {chapter.resources > 0 ? (
                <span className="chip border-line bg-surface text-[11px] text-muted">
                  <Layers size={11} className="mr-1 inline" />
                  {chapter.resources}
                </span>
              ) : null}
            </div>
            {chapter.description ? (
              <p className="mt-0.5 truncate text-xs text-muted">
                {chapter.description}
              </p>
            ) : null}
            <p className="mt-1 text-[11px] text-muted">
              {chapter.completedCount}/{chapter.conceptCount} concepts
              {chapter.concepts.length > 0
                ? ` · ${spread.easy} easy · ${spread.medium} medium · ${spread.hard} hard`
                : ""}
            </p>
          </div>
          <div className="hidden w-32 shrink-0 sm:block">
            <div className="flex items-end justify-between text-[11px]">
              <span className="text-muted">Coverage</span>
              <span className="font-semibold tabular-nums">
                {chapter.coverage}%
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-apex-gradient transition-all duration-700"
                style={{ width: `${chapter.coverage}%` }}
              />
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={`chapter-${chapter.id}`}
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-line px-4 py-4 sm:px-5">
              {chapter.concepts.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted">
                  No concepts yet — import a syllabus to populate this chapter.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {chapter.concepts.map((concept) => (
                    <ConceptCard
                      key={concept.id}
                      concept={concept}
                      onOpen={() => onOpenConcept(concept)}
                      onRevise={() => onQuickRevise(concept)}
                      onFlag={() => onToggleRevisionFlag(concept)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}