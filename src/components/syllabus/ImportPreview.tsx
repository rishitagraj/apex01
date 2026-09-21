"use client";

import { useMemo, useState } from "react";
import { Search, Pencil, Check, Trash2, GitMerge, X } from "lucide-react";
import type { RoadmapDraft } from "@/types/syllabus";

/**
 * Step 4 of the wizard: a tree of subjects → chapters → concepts, with
 * per-item checkboxes (drop before import), live search, inline rename, and
 * duplicate merging (concepts sharing a name inside a chapter).
 */
export function ImportPreview({
  roadmap,
  onChange,
}: {
  roadmap: RoadmapDraft;
  onChange: (next: RoadmapDraft) => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const counts = useMemo(() => {
    const subjects = roadmap.subjects.length;
    const chapters = roadmap.subjects.reduce((n, s) => n + s.chapters.length, 0);
    const concepts = roadmap.subjects.reduce(
      (n, s) => n + s.chapters.reduce((m, c) => m + c.concepts.length, 0),
      0,
    );
    return { subjects, chapters, concepts };
  }, [roadmap]);

  const q = query.trim().toLowerCase();

  const removeConcept = (si: number, ci: number, ki: number) => {
    const next: RoadmapDraft = structuredClone(roadmap);
    next.subjects[si].chapters[ci].concepts.splice(ki, 1);
    onChange(next);
  };

  const removeChapter = (si: number, ci: number) => {
    const next: RoadmapDraft = structuredClone(roadmap);
    next.subjects[si].chapters.splice(ci, 1);
    onChange(next);
  };

  const mergeDuplicates = () => {
    const next: RoadmapDraft = structuredClone(roadmap);
    for (const subject of next.subjects) {
      for (const chapter of subject.chapters) {
        const seen = new Map<string, number>();
        const merged: (typeof chapter.concepts)[number][] = [];
        for (const concept of chapter.concepts) {
          const key = concept.name.toLowerCase().trim();
          const idx = seen.get(key);
          if (idx === undefined) {
            seen.set(key, merged.length);
            merged.push(concept);
          } else {
            merged[idx].tags ??= [];
            merged[idx].prerequisites ??= [];
            for (const t of concept.tags ?? []) if (!merged[idx].tags!.includes(t)) merged[idx].tags!.push(t);
            for (const p of concept.prerequisites ?? []) if (!merged[idx].prerequisites!.includes(p)) merged[idx].prerequisites!.push(p);
          }
        }
        chapter.concepts = merged;
      }
    }
    onChange(next);
  };

  const commitRename = () => {
    if (!editing || !editDraft.trim()) return;
    const next: RoadmapDraft = structuredClone(roadmap);
    outer: for (const subject of next.subjects) {
      for (const chapter of subject.chapters) {
        const concept = chapter.concepts.find((c) => c.name === editing);
        if (concept) {
          concept.name = editDraft.trim();
          break outer;
        }
      }
    }
    onChange(next);
    setEditing(null);
  };

  const visible = (name: string) => !q || name.toLowerCase().includes(q);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-black/30 px-3 py-2">
          <Search size={15} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search concepts…"
            aria-label="Search concepts in preview"
            className="w-44 bg-transparent text-sm outline-none placeholder:text-muted sm:w-56"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={mergeDuplicates} className="btn">
            <GitMerge size={14} className="mr-1.5 inline" />
            Merge duplicates
          </button>
          <span className="text-xs text-muted">
            {counts.subjects} subjects · {counts.chapters} chapters · {counts.concepts} concepts
          </span>
        </div>
      </div>

      <ul className="space-y-3">
        {roadmap.subjects.map((subject, si) =>
          visible(subject.name) || q ? (
            <li key={si} className="card rounded-2xl p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-lg bg-apex-gradient px-2 py-0.5 text-xs font-bold text-white">
                  {subject.name} {subject.classLevel ? `· ${subject.classLevel}` : ""}
                </span>
                <span className="text-xs text-muted">{subject.examTags?.join(", ") || "general"}</span>
              </div>
              {subject.chapters.map((chapter, ci) =>
                visible(chapter.name) || q || chapter.concepts.some((c) => visible(c.name)) ? (
                  <div key={ci} className="mb-2 rounded-xl border border-line bg-black/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{chapter.name}</p>
                      <button
                        onClick={() => removeChapter(si, ci)}
                        aria-label={`Remove chapter ${chapter.name}`}
                        className="rounded-lg p-1 text-muted hover:text-rose-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <ul className="space-y-1">
                      {chapter.concepts.map((concept, ki) =>
                        visible(concept.name) ? (
                          <li
                            key={`${si}-${ci}-${ki}-${concept.name}`}
                            className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-white/[0.03]"
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: difficultyDot(concept.difficulty) }}
                            />
                            {editing === concept.name ? (
                              <input
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitRename();
                                  if (e.key === "Escape") setEditing(null);
                                }}
                                autoFocus
                                className="input min-w-0 flex-1 py-1"
                                aria-label="Rename concept"
                              />
                            ) : (
                              <span
                                className="min-w-0 flex-1 truncate"
                                onDoubleClick={() => {
                                  setEditing(concept.name);
                                  setEditDraft(concept.name);
                                }}
                                title="Double-click to rename"
                              >
                                {concept.name}
                                {concept.tags && concept.tags.length > 0
                                  ? ` · ${concept.tags.map((t) => `#${t}`).join(" ")}`
                                  : ""}
                              </span>
                            )}
                            {editing === concept.name ? (
                              <button onClick={commitRename} className="text-emerald-400" aria-label="Save name">
                                <Check size={15} />
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditing(concept.name);
                                  setEditDraft(concept.name);
                                }}
                                className="p-1 text-muted hover:text-foreground"
                                aria-label={`Rename ${concept.name}`}
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => removeConcept(si, ci, ki)}
                              aria-label={`Remove concept ${concept.name}`}
                              className="rounded p-1 text-muted hover:text-rose-400"
                            >
                              <X size={13} />
                            </button>
                          </li>
                        ) : null,
                      )}
                    </ul>
                  </div>
                ) : null,
              )}
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}

function difficultyDot(difficulty?: string): string {
  const key = (difficulty ?? "").toLowerCase();
  if (key.includes("easy")) return "#34d399";
  if (key.includes("hard") || key.includes("advanced")) return "#fb7185";
  return "#fbbf24";
}