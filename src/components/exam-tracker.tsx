"use client";

import { useSyllabus } from "@/hooks/useSyllabus";
import { ExamsPanel } from "@/components/syllabus/ExamsPanel";
import type { SyllabusTree } from "@/types/syllabus";

/** Exams panel wired to its own syllabus state, so it can run on the dashboard. */
export function ExamTracker({ initialTree }: { initialTree: SyllabusTree }) {
  const { tree, save, refresh } = useSyllabus(initialTree);
  return <ExamsPanel tree={tree} save={save} refresh={refresh} />;
}
