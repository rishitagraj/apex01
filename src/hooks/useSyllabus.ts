"use client";

import { useCallback, useState } from "react";
import type { ConceptVM, SyllabusTree } from "@/types/syllabus";

export const SYLLABUS_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "NEEDS_REVISION",
  "WEAK",
  "MASTERED",
] as const;

/**
 * Client-side state for the syllabus dashboard. Mutations go through the
 * /api/syllabus/save route (which re-derives mastery) and patch the tree
 * optimistically from the response. refresh() pulls the authoritative tree.
 */
export function useSyllabus(initialTree: SyllabusTree) {
  const [tree, setTree] = useState<SyllabusTree>(initialTree);
  const [busy, setBusy] = useState(false);

  const applyConceptPatch = useCallback(
    (
      conceptId: string,
      patch: Partial<ConceptVM> | ((c: ConceptVM) => Partial<ConceptVM>),
    ) => {
      setTree((t) => ({
        ...t,
        subjects: t.subjects.map((s) => ({
          ...s,
          chapters: s.chapters.map((ch) => ({
            ...ch,
            concepts: ch.concepts.map((c) =>
              c.id === conceptId
                ? { ...c, ...(typeof patch === "function" ? patch(c) : patch) }
                : c,
            ),
          })),
        })),
      }));
    },
    [],
  );

  const findConcept = useCallback(
    (conceptId: string): ConceptVM | undefined => {
      for (const s of tree.subjects) {
        for (const ch of s.chapters) {
          const c = ch.concepts.find((x) => x.id === conceptId);
          if (c) return c;
        }
      }
      return undefined;
    },
    [tree],
  );

  const save = useCallback(
    async (
      action: string,
      conceptId: string,
      extra: Record<string, unknown> = {},
    ) => {
      setBusy(true);
      try {
        const res = await fetch("/api/syllabus/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, conceptId, ...extra }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Request failed");
        }

        if (typeof data.coverage === "number" && data.status) {
          applyConceptPatch(conceptId, (c) => ({
            coverage: data.coverage,
            status: data.status,
            confidence:
              typeof data.confidence === "number"
                ? data.confidence
                : c.confidence,
          }));
        }

        if (Array.isArray(data.checklist)) {
          applyConceptPatch(conceptId, (c) => {
            const checklist = c.checklist.map((item) => {
              const next = (data.checklist as { task: string; done: boolean }[]).find(
                (r) => r.task === item.task,
              );
              return next ? { ...item, done: next.done } : item;
            });
            return {
              checklist,
              checklistDone: checklist.filter((x) => x.done).length,
            };
          });
        }

        if (data.revision?.id) {
          applyConceptPatch(conceptId, (c) => ({
            needsRevision: false,
            lastRevisedAt: data.revision.revisedAt,
            revisions: [data.revision, ...c.revisions].slice(0, 20),
          }));
        }

        return data;
      } finally {
        setBusy(false);
      }
    },
    [applyConceptPatch],
  );

  const refresh = useCallback(async () => {
    const res = await fetch("/api/syllabus/export?format=json", {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setTree(data);
    }
  }, []);

  const removeConcept = useCallback((conceptId: string) => {
    setTree((t) => ({
      ...t,
      subjects: t.subjects.map((s) => ({
        ...s,
        chapters: s.chapters.map((ch) => ({
          ...ch,
          concepts: ch.concepts.filter((c) => c.id !== conceptId),
        })),
      })),
    }));
  }, []);

  return {
    tree,
    setTree,
    busy,
    save,
    refresh,
    applyConceptPatch,
    findConcept,
    removeConcept,
  };
}