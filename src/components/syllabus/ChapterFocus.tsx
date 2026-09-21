"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";
import { ChapterCard } from "@/components/syllabus/ChapterCard";
import { ConceptDrawer } from "@/components/syllabus/ConceptDrawer";
import { ProgressRing } from "@/components/syllabus/ProgressRing";
import { useSyllabus } from "@/hooks/useSyllabus";
import type { ChapterVM, ConceptVM, SyllabusTree } from "@/types/syllabus";

/**
 * Single-chapter focus page: breadcrumb, coverage hero and the full concept
 * list (auto-expanded) with the master drawer for progress/notes/resources.
 */
export function ChapterFocus({
  initialTree,
  subjectId,
  chapterId,
}: {
  initialTree: SyllabusTree;
  subjectId: string;
  chapterId: string;
}) {
  const { tree, save } = useSyllabus(initialTree);
  const [openConcept, setOpenConcept] = useState<ConceptVM | null>(null);

  const found = useMemo(() => {
    const subject = tree.subjects.find((s) => s.id === subjectId);
    const chapter = subject?.chapters.find((ch) => ch.id === chapterId);
    return subject && chapter
      ? { subject, chapter: chapter as ChapterVM }
      : null;
  }, [tree, subjectId, chapterId]);

  const quickRevise = (concept: ConceptVM) => void save("revise", concept.id, { kind: "MANUAL" });
  const toggleFlag = (concept: ConceptVM) =>
    void save("toggleRevisionFlag", concept.id, { needsRevision: !concept.needsRevision });

  if (!found) return null;

  const { subject, chapter } = found;

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-2 text-xs text-muted">
        <Link href="/syllabus" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft size={13} /> Syllabus
        </Link>
        <span>/</span>
        <Link href={`/syllabus/${subject.id}`} className="hover:text-foreground">
          {subject.name}
        </Link>
      </nav>

      <div className="card flex flex-wrap items-center gap-5 rounded-3xl p-5">
        <ProgressRing value={chapter.coverage} size={72} stroke={7} />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted">{subject.name}</p>
          <h1 className="text-gradient text-xl font-extrabold tracking-tight sm:text-2xl">{chapter.name}</h1>
          {chapter.description ? (
            <p className="mt-0.5 text-sm text-muted">{chapter.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-4 text-center">
          <div>
            <p className="text-lg font-extrabold tabular-nums text-apex">
              {chapter.completedCount}
            </p>
            <p className="text-[11px] text-muted">completed</p>
          </div>
          <div>
            <p className="text-lg font-extrabold tabular-nums text-apex">
              {chapter.concepts.length}
            </p>
            <p className="text-[11px] text-muted">concepts</p>
          </div>
          <div>
            <p className="text-lg font-extrabold tabular-nums text-apex">
              {chapter.revisionDue}
            </p>
            <p className="text-[11px] text-muted">to revise</p>
          </div>
        </div>
      </div>

      <ChapterCard
        chapter={chapter}
        expanded
        onToggle={() => undefined}
        onOpenConcept={setOpenConcept}
        onQuickRevise={quickRevise}
        onToggleRevisionFlag={toggleFlag}
      />

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted">
        <Layers size={12} /> Mark checklist items to build mastery — revisions appear on your heatmap.
      </p>

      {openConcept ? (
        <ConceptDrawer
          key={openConcept.id}
          concept={openConcept}
          onClose={() => setOpenConcept(null)}
          save={save}
        />
      ) : null}
    </div>
  );
}