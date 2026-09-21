"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChecklistTask, RevisionKind } from "@/types/syllabus";

interface SaveFn {
  (
    action: string,
    conceptId: string,
    extra?: Record<string, unknown>,
  ): Promise<{ ok: boolean; [k: string]: unknown }>;
}

/**
 * State + save plumbing for one concept's drawer: autosaved notes, confidence,
 * checklist toggles, revision logging, revision-flag and mistake capture.
 */
export function useConceptProgress(input: {
  conceptId: string;
  save: SaveFn;
  initialConfidence: number;
  initialNotes: string;
  initialNeedsRevision: boolean;
}) {
  const { conceptId, save, initialConfidence, initialNotes } = input;
  const [confidence, setConfidenceState] = useState(initialConfidence);
  const [notes, setNotes] = useState(initialNotes);
  const [notesSaved, setNotesSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  const request = useCallback(
    async (
      action: string,
      extra: Record<string, unknown> = {},
    ): Promise<boolean> => {
      setSaving(true);
      setError(null);
      try {
        const data = await save(action, conceptId, extra);
        if (!data.ok) {
          setError(String(data.error || "Save failed"));
          return false;
        }
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [save, conceptId],
  );

  const flushNotes = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (!dirtyRef.current) return;
    const body = notes;
    const ok = await request("notes", { notes: body });
    if (ok) {
      dirtyRef.current = false;
      setNotesSaved(true);
    }
  }, [notes, request]);

  const updateNotes = useCallback((value: string) => {
    if (value !== notes) dirtyRef.current = true;
    setNotes(value);
    setNotesSaved(false);
  }, [notes]);

  useEffect(() => {
    if (notes === initialNotes) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flushNotes();
    }, 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [notes, flushNotes, initialNotes]);

  useEffect(() => () => void flushNotes(), [flushNotes]);

  const setConfidence = useCallback(
    (value: number) => {
      setConfidenceState(value);
      void request("confidence", { confidence: value });
    },
    [request],
  );

  const toggleTask = useCallback(
    (task: ChecklistTask, done: boolean) => {
      void request("checklist", { task, done });
    },
    [request],
  );

  const revise = useCallback(
    (kind: RevisionKind = "MANUAL", note?: string) => {
      void request("revise", { kind, note });
    },
    [request],
  );

  const toggleRevisionFlag = useCallback(
    (needsRevision: boolean) => {
      void request("toggleRevisionFlag", { needsRevision });
    },
    [request],
  );

  const addMistake = useCallback(
    (text: string, source?: string) => void request("mistake", { text, source }),
    [request],
  );

  return {
    confidence,
    notes,
    notesSaved,
    saving,
    error,
    setConfidence,
    setNotes: updateNotes,
    flushNotes,
    toggleTask,
    revise,
    toggleRevisionFlag,
    addMistake,
  };
}