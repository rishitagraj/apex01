"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  X,
  RefreshCw,
  TriangleAlert,
  Star,
  Save,
  Loader2,
  Plus,
  Clapperboard,
  FileText,
  Link2,
  File,
  FileImage,
  StickyNote,
  BookOpen,
} from "lucide-react";
import {
  STATUS_CHIP,
  STATUS_LABEL,
  REVISION_LABEL,
  RESOURCE_LABEL,
} from "@/components/syllabus/colors";
import { ProgressRing } from "@/components/syllabus/ProgressRing";
import { DifficultyBadge } from "@/components/syllabus/DifficultyBadge";
import { formatMinutes } from "@/components/ui";
import { useConceptProgress } from "@/hooks/useConceptProgress";
import type {
  ChecklistTask,
  ConceptVM,
  ResourceVM,
} from "@/types/syllabus";

function useIsDesktop() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(min-width: 640px)").matches;
}

function ResourceIcon({ kind }: { kind: ResourceVM["kind"] }) {
  const icons: Record<ResourceVM["kind"], { icon: typeof File; color: string }> = {
    PDF: { icon: FileText, color: "text-rose-300" },
    IMAGE: { icon: FileImage, color: "text-sky-300" },
    MARKDOWN: { icon: StickyNote, color: "text-emerald-300" },
    FORMULA: { icon: BookOpen, color: "text-amber-300" },
    DPP: { icon: File, color: "text-purple-300" },
    PYQ: { icon: FileText, color: "text-cyan-300" },
    LINK: { icon: Link2, color: "text-muted" },
    YOUTUBE: { icon: Clapperboard, color: "text-rose-300" },
  };
  const { icon: Icon, color } = icons[kind];
  return <Icon size={14} className={`shrink-0 ${color}`} />;
}

export function ConceptDrawer({
  concept,
  onClose,
  save,
}: {
  concept: ConceptVM;
  onClose: () => void;
  save: (
    action: string,
    conceptId: string,
    extra?: Record<string, unknown>,
  ) => Promise<{ ok: boolean; [k: string]: unknown }>;
}) {
  const reduced = useReducedMotion();
  const progress = useConceptProgress({
    conceptId: concept.id,
    save,
    initialConfidence: concept.confidence,
    initialNotes: concept.notes,
    initialNeedsRevision: concept.needsRevision,
  });
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={`${concept.name} progress`}
        initial={
          reduced
            ? false
            : isDesktop
              ? { x: "100%" }
              : { y: "100%" }
        }
        animate={{ x: 0, y: 0 }}
        exit={
          reduced
            ? undefined
            : isDesktop
              ? { x: "100%" }
              : { y: "100%" }
        }
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-line bg-[#12111a] shadow-2xl shadow-black/60 sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[480px] sm:max-h-none sm:rounded-none sm:border-l"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-[#14131c]/90 px-5 py-4 backdrop-blur-xl">
          <div className="min-w-0">
            <p className="truncate text-[11px] text-muted">
              {concept.name}
            </p>
            <h2 className="truncate text-lg font-bold">{concept.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`chip ${STATUS_CHIP[concept.status]}`}
              role="status"
            >
              {STATUS_LABEL[concept.status]}
            </span>
            {progress.saving ? <Loader2 size={15} className="animate-spin text-muted" /> : null}
            <button
              onClick={onClose}
              aria-label="Close details"
              className="rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-6 px-5 py-5">
          <div className="flex items-center gap-4">
            <ProgressRing value={concept.coverage} size={84} label="Mastery" />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <DifficultyBadge difficulty={concept.difficulty} />
                {concept.tags.map((t) => (
                  <span key={t} className="chip border-line bg-surface px-1.5 py-0 text-[10px] text-muted">
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted">
                {formatMinutes(concept.studyMinutes)} studied ·{" "}
                {concept.checklistDone}/{concept.checklistTotal} steps
                {concept.estimatedHours ? ` · ~${concept.estimatedHours}h planned` : ""}
              </p>
              {concept.lastRevisedAt ? (
                <p className="text-xs text-muted">
                  Last revised{" "}
                  {new Date(concept.lastRevisedAt).toLocaleDateString()}
                </p>
              ) : null}
            </div>
          </div>

          {progress.error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {progress.error}
            </p>
          ) : null}

          <section aria-labelledby="conf-label">
            <div className="mb-1 flex items-center justify-between">
              <label id="conf-label" className="text-xs font-medium text-muted">
                Confidence
              </label>
              <span className="text-xs font-bold tabular-nums text-apex">
                {progress.confidence}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress.confidence}
              onChange={(e) => progress.setConfidence(Number(e.target.value))}
              aria-label="Confidence"
              className="w-full accent-[#ff7a1a]"
            />
          </section>

          <section aria-labelledby="checklist-label">
            <h3 id="checklist-label" className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Learning checklist
            </h3>
            <ul className="space-y-1">
              {concept.checklist.map((item) => (
                <li key={item.task}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-black/20 px-3 py-2 text-sm transition hover:border-apex/30">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={(e) =>
                        progress.toggleTask(item.task as ChecklistTask, e.target.checked)
                      }
                      className="h-4 w-4 accent-[#ff7a1a]"
                    />
                    <span
                      className={`flex-1 ${item.done ? "line-through text-muted" : ""}`}
                    >
                      {item.label}
                    </span>
                    <span className="text-[10px] font-medium tabular-nums text-muted">
                      +{item.weight} pts
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="notes-label">
            <h3 id="notes-label" className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
              Notes
              {!progress.notesSaved ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-normal text-amber-300">
                  <Save size={11} /> saving…
                </span>
              ) : progress.notes ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-normal text-emerald-300">
                  <Save size={11} /> saved
                </span>
              ) : null}
            </h3>
            <textarea
              value={progress.notes}
              onChange={(e) => progress.setNotes(e.target.value)}
              placeholder="Capture your understanding, formulas, mistakes…"
              rows={5}
              aria-label="Concept notes"
              className="input w-full resize-y leading-relaxed"
            />
          </section>

          <section aria-labelledby="rev-label">
            <h3 id="rev-label" className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Revision
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => progress.revise("MANUAL")}
                className="btn"
              >
                <RefreshCw size={14} className="mr-1.5 inline" />
                Log revision
              </button>
              <button
                onClick={() => progress.toggleRevisionFlag(!concept.needsRevision)}
                aria-pressed={concept.needsRevision}
                className={`btn ${
                  concept.needsRevision
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : ""
                }`}
              >
                <TriangleAlert size={14} className="mr-1.5 inline" />
                {concept.needsRevision ? "Unflag" : "Flag for revision"}
              </button>
            </div>
            {concept.revisions.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {concept.revisions.slice(0, 6).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-line bg-black/20 px-3 py-1.5 text-[11px]"
                  >
                    <span className="text-muted">
                      {REVISION_LABEL[r.kind] ?? r.kind}
                      {r.note ? ` — ${r.note}` : ""}
                    </span>
                    <span className="tabular-nums text-muted">
                      {new Date(r.revisedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-muted">
                No revisions logged yet.
              </p>
            )}
          </section>

          <section aria-labelledby="mistakes-label">
            <h3 id="mistakes-label" className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Mistakes ({concept.mistakesCount})
            </h3>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const input = new FormData(e.currentTarget);
                const text = String(input.get("mistake") ?? "").trim();
                if (!text) return;
                progress.addMistake(text, "manual");
                e.currentTarget.reset();
              }}
            >
              <input
                name="mistake"
                placeholder="What went wrong? e.g. sign error in quadratic formula"
                aria-label="New mistake"
                className="input flex-1"
              />
              <button type="submit" aria-label="Add mistake" className="btn">
                <Plus size={14} />
              </button>
            </form>
          </section>

          <section aria-labelledby="res-label">
            <h3 id="res-label" className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Resources ({concept.resources.length})
            </h3>
            {concept.resources.length === 0 ? (
              <p className="text-[11px] text-muted">
                Resources are created when you import a syllabus or add them here later.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {concept.resources.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 rounded-xl border border-line bg-black/20 px-3 py-2"
                  >
                    <ResourceIcon kind={r.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{r.title}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted">
                        {RESOURCE_LABEL[r.kind]}
                        {r.size ? ` · ${formatBytes(r.size)}` : ""}
                      </p>
                    </div>
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-medium text-apex hover:underline"
                      >
                        Open
                      </a>
                    ) : null}
                    <button
                      onClick={() =>
                        void save("favouriteResource", concept.id, {
                          resourceId: r.id,
                          favourite: !r.favourite,
                        })
                      }
                      aria-pressed={r.favourite}
                      aria-label={r.favourite ? "Unfavourite" : "Favourite"}
                      className={`rounded-lg p-1 transition ${
                        r.favourite ? "text-amber-300" : "text-muted hover:text-foreground"
                      }`}
                    >
                      <Star size={15} fill={r.favourite ? "currentColor" : "none"} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}