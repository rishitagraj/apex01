"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  X,
  RefreshCw,
  TriangleAlert,
  Star,
  Save,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Check,
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
  ChecklistItemVM,
  ChecklistTask,
  ConceptVM,
  ResourceVM,
  SyllabusStatus,
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

  const [items, setItems] = useState<ChecklistItemVM[]>(concept.checklist);
  const [coverage, setCoverage] = useState(concept.coverage);
  const [status, setStatus] = useState<SyllabusStatus>(concept.status);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [busyItem, setBusyItem] = useState(false);

  const applyOutcome = (data: { ok?: boolean; [k: string]: unknown }) => {
    if (typeof data.coverage === "number") setCoverage(data.coverage);
    if (data.status) setStatus(data.status as SyllabusStatus);
  };

  const toVM = (raw: {
    id: string;
    label: string;
    weight: number;
    done: boolean;
  }): ChecklistItemVM => ({
    id: raw.id,
    task: null,
    label: raw.label,
    weight: raw.weight,
    done: raw.done,
  });

  const toggleTask = (task: ChecklistTask, done: boolean) => {
    const item = items.find((i) => i.task === task);
    if (!item) return;
    setItems((prev) =>
      prev.map((i) => (i.task === task ? { ...i, done } : i)),
    );
    void save("checklist", concept.id, { task, done }).then(applyOutcome);
  };

  const toggleCustom = (item: ChecklistItemVM, done: boolean) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, done } : i)),
    );
    void save("toggleCustomChecklist", concept.id, {
      itemId: item.id,
      done,
    }).then(applyOutcome);
  };

  const addItem = async () => {
    const label = newLabel.trim();
    if (!label || busyItem) return;
    setBusyItem(true);
    try {
      const res = await save("addCustomChecklist", concept.id, { label });
      if (res.ok && res.item) {
        setItems((prev) => [...prev, toVM(res.item as { id: string; label: string; weight: number; done: boolean })]);
        setNewLabel("");
      }
      applyOutcome(res);
    } finally {
      setBusyItem(false);
    }
  };

  const startEdit = (item: ChecklistItemVM) => {
    setEditingId(item.id);
    setEditLabel(item.label);
  };

  const saveEdit = async () => {
    const label = editLabel.trim();
    if (!editingId || !label || busyItem) return;
    setBusyItem(true);
    try {
      const res = await save("updateCustomChecklist", concept.id, {
        itemId: editingId,
        label,
      });
      if (res.ok && res.item) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === editingId
              ? toVM(res.item as { id: string; label: string; weight: number; done: boolean })
              : i,
          ),
        );
      }
      applyOutcome(res);
      setEditingId(null);
      setEditLabel("");
    } finally {
      setBusyItem(false);
    }
  };

  const removeItem = async (item: ChecklistItemVM) => {
    const index = items.findIndex((i) => i.id === item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const res = await save("removeCustomChecklist", concept.id, {
      itemId: item.id,
    });
    if (!res.ok) {
      setItems((prev) => {
        const next = [...prev];
        next.splice(index, 0, item);
        return next;
      });
    }
    applyOutcome(res);
  };

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
              className={`chip ${STATUS_CHIP[status]}`}
              role="status"
            >
              {STATUS_LABEL[status]}
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
            <ProgressRing value={coverage} size={84} label="Mastery" />
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
                {items.filter((i) => i.done).length}/{items.length} steps
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
              {items.map((item) =>
                item.task ? (
                  <li key={item.task}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-black/20 px-3 py-2 text-sm transition hover:border-apex/30">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={(e) =>
                          toggleTask(item.task as ChecklistTask, e.target.checked)
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
                ) : (
                  <li key={item.id} className="group">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-2 rounded-xl border border-apex/40 bg-black/20 px-3 py-2">
                        <input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveEdit();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                          aria-label="Edit step label"
                          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                          placeholder="Step label"
                        />
                        <button
                          onClick={() => void saveEdit()}
                          disabled={busyItem}
                          aria-label="Save step"
                          className="rounded-lg p-1.5 text-emerald-300 transition hover:bg-surface"
                        >
                          {busyItem ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Check size={14} />
                          )}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel editing"
                          className="rounded-lg p-1.5 text-muted transition hover:bg-surface"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl border border-dashed border-line bg-black/20 px-3 py-2 text-sm transition hover:border-apex/30">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={(e) => toggleCustom(item, e.target.checked)}
                          className="h-4 w-4 accent-[#ff7a1a]"
                          aria-label={`Mark "${item.label}" done`}
                        />
                        <span
                          className={`min-w-0 flex-1 ${item.done ? "line-through text-muted" : ""}`}
                        >
                          {item.label}
                        </span>
                        <span className="text-[10px] font-medium tabular-nums text-muted">
                          +{item.weight} pts
                        </span>
                        <button
                          onClick={() => startEdit(item)}
                          aria-label={`Edit "${item.label}"`}
                          className="rounded-lg p-1.5 text-muted opacity-0 transition hover:bg-surface hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => void removeItem(item)}
                          aria-label={`Remove "${item.label}"`}
                          className="rounded-lg p-1.5 text-muted opacity-0 transition hover:bg-surface hover:text-rose-300 focus:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </li>
                ),
              )}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void addItem();
              }}
            >
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Add a custom step…"
                aria-label="New checklist step"
                className="input flex-1"
              />
              <button
                type="submit"
                disabled={busyItem || !newLabel.trim()}
                aria-label="Add step"
                className="btn"
              >
                {busyItem ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </button>
            </form>
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