"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Upload,
  Download,
  Settings,
  GraduationCap,
  RefreshCw,
  Layers,
  Sparkles,
} from "lucide-react";
import { StatsCards } from "@/components/syllabus/StatsCards";
import { FilterBar, DEFAULT_FILTERS, type SyllabusFilters } from "@/components/syllabus/FilterBar";
import { ChapterCard } from "@/components/syllabus/ChapterCard";
import { ConceptDrawer } from "@/components/syllabus/ConceptDrawer";
import { useSyllabus } from "@/hooks/useSyllabus";
import type { ConceptVM, SyllabusTree } from "@/types/syllabus";

export function CoverageDashboard({ initialTree }: { initialTree: SyllabusTree }) {
  const { tree, busy, save, refresh } = useSyllabus(initialTree);
  const [filters, setFilters] = useState<SyllabusFilters>(DEFAULT_FILTERS);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openConcept, setOpenConcept] = useState<ConceptVM | null>(null);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const s of tree.subjects) {
      for (const e of s.examTags) set.add(e);
      for (const ch of s.chapters) {
        for (const c of ch.concepts) for (const t of c.tags) set.add(t);
      }
    }
    return [...set].sort();
  }, [tree]);

  const subjects = useMemo(() => {
    let list = tree.subjects;
    if (filters.subject !== "all") {
      list = list.filter((s) => s.id === filters.subject);
    }
    if (filters.classLevel !== "all") {
      list = list.filter((s) => s.classLevel === filters.classLevel);
    }
    return list;
  }, [tree.subjects, filters.subject, filters.classLevel]);

  const query = filters.search.trim().toLowerCase();

  const chapters = useMemo(() => {
    const queryActive = query.length > 0;
    const out: Array<{
      subjectName: string;
      subjectClass: string | null;
      chapter: (typeof subjects)[number]["chapters"][number];
    }> = [];
    for (const s of subjects) {
      for (const ch of s.chapters) {
        const concepts = ch.concepts.filter((c) => {
          if (filters.status !== "all" && c.status !== filters.status) return false;
          if (filters.tag !== "all" && !c.tags.includes(filters.tag) && !s.examTags.includes(filters.tag)) return false;
          if (queryActive) {
            const hay = `${c.name} ${ch.name} ${s.name} ${c.tags.join(" ")}`.toLowerCase();
            if (!hay.includes(query)) return false;
          }
          return true;
        });
        if (queryActive || filters.status !== "all" || filters.tag !== "all") {
          if (concepts.length === 0) continue;
        }
        out.push({ subjectName: s.name, subjectClass: s.classLevel, chapter: { ...ch, concepts } });
      }
    }

    const sort = filters.sort;
    out.sort((a, b) => {
      if (sort === "name") return a.chapter.name.localeCompare(b.chapter.name);
      if (sort === "coverage") return b.chapter.coverage - a.chapter.coverage;
      if (sort === "recent") {
        const ar = Math.max(...a.chapter.concepts.map((c) => new Date(c.lastRevisedAt ?? 0).getTime()));
        const br = Math.max(...b.chapter.concepts.map((c) => new Date(c.lastRevisedAt ?? 0).getTime()));
        return br - ar;
      }
      return a.chapter.order - b.chapter.order;
    });
    return out;
  }, [subjects, filters, query]);

  const resultCount = chapters.reduce((n, c) => n + c.chapter.concepts.length, 0);

  const quickRevise = useCallback(
    (concept: ConceptVM) => void save("revise", concept.id, { kind: "MANUAL" }),
    [save],
  );
  const toggleFlag = useCallback(
    (concept: ConceptVM) =>
      void save("toggleRevisionFlag", concept.id, {
        needsRevision: !concept.needsRevision,
      }),
    [save],
  );

  const totalConcepts = tree.stats.totalConcepts;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-gradient text-2xl font-extrabold tracking-tight sm:text-3xl">
            Syllabus Coverage
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track mastery of every concept across your syllabus.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/syllabus/import" className="btn bg-apex-gradient text-white shadow-lg shadow-apex/25 hover:opacity-90">
            <Upload size={15} className="mr-1.5 inline" />
            Import Syllabus
          </Link>
          <button
            onClick={() => {
              const a = document.createElement("a");
              a.href = "/api/syllabus/export?format=json";
              a.download = "apex-syllabus.json";
              a.click();
            }}
            className="btn"
            aria-label="Export progress as JSON"
          >
            <Download size={15} className="mr-1.5 inline" />
            Export Progress
          </button>
          <Link href="/syllabus/settings" className="btn" aria-label="Syllabus settings">
            <Settings size={15} />
          </Link>
          <button
            onClick={() => void refresh()}
            disabled={busy}
            className="btn"
            aria-label="Refresh"
          >
            <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <StatsCards
        conceptsCompleted={tree.stats.conceptsCompleted}
        totalConcepts={totalConcepts}
        coverage={tree.stats.coverage}
        needsRevision={tree.stats.needsRevision}
        streakDays={tree.stats.streakDays}
        weakCount={tree.stats.weakCount}
        masteredCount={tree.stats.masteredCount}
      />

      {totalConcepts === 0 ? (
        <div className="card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-apex-gradient text-white shadow-xl shadow-apex/25">
            <GraduationCap size={30} />
          </span>
          <div>
            <h2 className="text-lg font-bold">No syllabus imported yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Upload any syllabus PDF — CBSE, JEE, NEET, Olympiad or a custom
              roadmap — and Apex will build your interactive coverage map.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/syllabus/import" className="btn bg-apex-gradient text-white shadow-lg shadow-apex/25">
              <Sparkles size={15} className="mr-1.5 inline" />
              Import a syllabus
            </Link>
            <Link href="/syllabus/import?skip=1" className="btn">
              <Layers size={15} className="mr-1.5 inline" />
              Start from a template
            </Link>
          </div>
        </div>
      ) : (
        <>
          <FilterBar
            subjects={tree.subjects}
            availableTags={availableTags}
            value={filters}
            onChange={setFilters}
            resultCount={resultCount}
          />

          <div className="space-y-3">
            {chapters.map(({ chapter }) => (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                expanded={!!expanded[chapter.id]}
                onToggle={() =>
                  setExpanded((prev) => ({ ...prev, [chapter.id]: !prev[chapter.id] }))
                }
                onOpenConcept={(c) => setOpenConcept(c)}
                onQuickRevise={quickRevise}
                onToggleRevisionFlag={toggleFlag}
              />
            ))}
            {chapters.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted">
                No chapters match the current filters.
              </p>
            ) : null}
          </div>
        </>
      )}

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