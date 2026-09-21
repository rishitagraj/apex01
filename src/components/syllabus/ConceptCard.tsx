"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  RefreshCw,
  Layers,
  Clock,
  Tag,
  TriangleAlert,
  ChevronRight,
} from "lucide-react";
import {
  STATUS_LABEL,
  STATUS_CHIP,
  STATUS_GLOW,
} from "@/components/syllabus/colors";
import { DifficultyBadge } from "@/components/syllabus/DifficultyBadge";
import { formatDate, formatMinutes } from "@/components/ui";
import type { ConceptVM } from "@/types/syllabus";

function MiniBar({ value }: { value: number }) {
  const reduced = useReducedMotion();
  return (
    <div
      className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${value}% coverage`}
    >
      <motion.div
        className="h-full rounded-full bg-apex-gradient"
        initial={false}
        animate={{ width: `${value}%` }}
        transition={{ duration: reduced ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

export function ConceptCard({
  concept,
  onOpen,
  onRevise,
  onFlag,
}: {
  concept: ConceptVM;
  onOpen: () => void;
  onRevise: () => void;
  onFlag: () => void;
}) {
  return (
    <motion.div
      layout
      className={`group relative flex flex-col gap-3 rounded-2xl border border-line bg-black/20 p-4 transition hover:-translate-y-0.5 hover:border-apex/30 hover:shadow-lg hover:shadow-black/30 ${STATUS_GLOW[concept.status]}`}
    >
      <button
        onClick={onOpen}
        className="absolute inset-0 rounded-2xl"
        aria-label={`Open ${concept.name}`}
        aria-describedby={`${concept.id}-meta`}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_CHIP[concept.status].split(" ")[2] ?? "bg-muted"}`}
          />
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold group-hover:text-apex">
              {concept.name}
            </h4>
            <p className="text-[11px] text-muted" id={`${concept.id}-meta`}>
              {STATUS_LABEL[concept.status]}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <DifficultyBadge difficulty={concept.difficulty} size="xs" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <MiniBar value={concept.coverage} />
        <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-muted">
          {concept.coverage}%
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <LayerIcon /> {concept.resourceCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock size={11} /> {formatMinutes(concept.studyMinutes)}
        </span>
        <span className="inline-flex items-center gap-1">
          <ChecklistProgress done={concept.checklistDone} total={concept.checklistTotal} />
        </span>
        {concept.lastRevisedAt ? (
          <span>revised {formatDate(concept.lastRevisedAt)}</span>
        ) : null}
      </div>

      {concept.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {concept.tags.slice(0, 3).map((t) => (
            <span key={t} className="chip border-line bg-surface px-1.5 py-0 text-[10px] text-muted">
              <Tag size={9} className="mr-1 inline -scale-x-100" />
              {t}
            </span>
          ))}
          {concept.tags.length > 3 ? (
            <span className="chip border-line bg-surface px-1.5 py-0 text-[10px] text-muted">
              +{concept.tags.length - 3}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        className="relative z-10 mt-auto flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {concept.status !== "MASTERED" ? (
          <button
            onClick={onRevise}
            className="chip border-apex/30 bg-apex/10 text-[11px] font-medium text-apex transition hover:bg-apex/20"
          >
            <RefreshCw size={11} className="mr-1 inline" />
            Revise
          </button>
        ) : null}
        <button
          onClick={onFlag}
          aria-pressed={concept.needsRevision}
          className={`chip text-[11px] transition ${
            concept.needsRevision
              ? "border-amber-500/40 bg-amber-500/10 font-medium text-amber-300"
              : "border-line bg-surface text-muted hover:text-foreground"
          }`}
        >
          <TriangleAlert size={11} className="mr-1 inline" />
          {concept.needsRevision ? "Flagged" : "Flag"}
        </button>
        <span className="ml-auto flex items-center gap-0.5 text-[11px] font-medium text-muted group-hover:text-apex">
          Details <ChevronRight size={13} />
        </span>
      </div>
    </motion.div>
  );
}

function LayerIcon() {
  return <Layers size={11} />;
}

function ChecklistProgress({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-medium text-foreground">{done}</span>/{total} steps
    </span>
  );
}