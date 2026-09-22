"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Upload,
  Download,
  Settings,
  GraduationCap,
  RefreshCw,
  Layers,
  Sparkles,
  List,
  Network,
  TrendingUp,
  CalendarCheck,
  Loader2,
  PenLine,
} from "lucide-react";
import { StatsCards } from "@/components/syllabus/StatsCards";
import { FilterBar, DEFAULT_FILTERS, type SyllabusFilters } from "@/components/syllabus/FilterBar";
import { ChapterCard } from "@/components/syllabus/ChapterCard";
import { SubjectSection } from "@/components/syllabus/SubjectSection";
import { ConceptDrawer } from "@/components/syllabus/ConceptDrawer";
import { KnowledgeGraph } from "@/components/syllabus/KnowledgeGraph";
import { RevisionHeatmap } from "@/components/syllabus/RevisionHeatmap";
import { CoverageTimeline } from "@/components/syllabus/CoverageTimeline";
import { ManualSyllabusForm } from "@/components/syllabus/ManualSyllabusForm";
import { useSyllabus } from "@/hooks/useSyllabus";
import type { ConceptVM, Insights, SyllabusTree } from "@/types/syllabus";

type ViewMode = "list" | "graph";

export function CoverageDashboard({
  initialTree,
  initialSubjectId,
  initialFocusId,
}: {
  initialTree: SyllabusTree;
  initialSubjectId?: string;
  initialFocusId?: string;
}) {
  const { tree, busy, save, refresh } = useSyllabus(initialTree);
  const [filters, setFilters] = useState<SyllabusFilters>(() => ({
    ...DEFAULT_FILTERS,
    subject: initialSubjectId ?? DEFAULT_FILTERS.subject,
  }));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [subjectExpanded, setSubjectExpanded] = useState<Record<string, boolean>>({});
  const [openConcept, setOpenConcept] = useState<ConceptVM | null>(() =>
    findConcept(tree.subjects, initialFocusId),
  );
  const [view, setView] = useState<ViewMode>("list");
  const [showManual, setShowManual] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsTick, setInsightsTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const q = filters.subject !== "all" ? `?subject=${encodeURIComponent(filters.subject)}` : "";
    fetch(`/api/syllabus/insights${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("insights failed"))))
      .then((data: Insights) => {
        if (cancelled) return;
        setInsights(data);
      })
      .catch(() => {
        if (!cancelled) setInsights(null);
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters.subject, insightsTick]);

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
      subject: (typeof subjects)[number];
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
        out.push({ subject: s, chapter: { ...ch, concepts } });
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

  const sections = useMemo(() => {
    const hasFilter =
      query.length > 0 ||
      filters.status !== "all" ||
      filters.tag !== "all";
    const groups = subjects.map((subject) => ({
      subject,
      chapters: chapters
        .filter((x) => x.subject.id === subject.id)
        .map((x) => x.chapter),
    }));
    if (hasFilter) return groups.filter((g) => g.chapters.length > 0);
    return groups;
  }, [chapters, subjects, query, filters.status, filters.tag]);

  const resultCount = chapters.reduce((n, c) => n + c.chapter.concepts.length, 0);

  const quickRevise = useCallback(
    (concept: ConceptVM) => {
      void save("revise", concept.id, { kind: "MANUAL" });
      setInsightsTick((t) => t + 1);
    },
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
            onClick={() => setShowManual((v) => !v)}
            aria-expanded={showManual}
            className="btn"
          >
            <PenLine size={15} className="mr-1.5 inline" />
            {showManual ? "Close" : "Add Manually"}
          </button>
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

      {showManual ? (
        <ManualSyllabusForm
          onDone={() => {
            setShowManual(false);
            void refresh();
          }}
        />
      ) : null}

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
            <button onClick={() => setShowManual(true)} className="btn">
              <PenLine size={15} className="mr-1.5 inline" />
              Add manually
            </button>
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

          <div className="card rounded-3xl p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp size={16} className="text-apex" /> Activity insights
              </h2>
              <span className="text-[11px] text-muted">
                {filters.subject === "all" ? "All subjects" : "Scoped to selected subject"}
              </span>
            </div>
            {insightsLoading ? (
              <div className="flex items-center gap-2 py-10 text-sm text-muted">
                <Loader2 size={16} className="animate-spin" /> Crunching your study history…
              </div>
            ) : insights ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
                    <CalendarCheck size={13} /> Revisions in the last 16 weeks
                  </p>
                  <RevisionHeatmap cells={insights.heatmap} />
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
                    <TrendingUp size={13} /> Coverage growth
                  </p>
                  <CoverageTimeline points={insights.timeline} />
                </div>
              </div>
            ) : (
              <p className="py-6 text-sm text-muted">No revision activity yet — mark concepts as revised to see trends.</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
              <button
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  view === "list" ? "bg-apex-gradient text-white" : "text-muted hover:text-foreground"
                }`}
              >
                <List size={14} className="mr-1 inline" /> List
              </button>
              <button
                onClick={() => setView("graph")}
                aria-pressed={view === "graph"}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  view === "graph" ? "bg-apex-gradient text-white" : "text-muted hover:text-foreground"
                }`}
              >
                <Network size={14} className="mr-1 inline" /> Knowledge graph
              </button>
            </div>
            <span className="text-[11px] text-muted">{resultCount} concepts visible</span>
          </div>

          {view === "graph" ? (
            <KnowledgeGraph tree={tree} />
          ) : (
            <div className="space-y-4">
              {sections.map(({ subject, chapters: chs }) => (
                <SubjectSection
                  key={subject.id}
                  subject={subject}
                  chapters={chs}
                  expanded={subjectExpanded[subject.id] !== false}
                  onToggle={() =>
                    setSubjectExpanded((prev) => ({
                      ...prev,
                      [subject.id]: prev[subject.id] === false,
                    }))
                  }
                >
                  {chs.map((chapter) => (
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
                </SubjectSection>
              ))}
              {sections.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">
                  No chapters match the current filters.
                </p>
              ) : null}
            </div>
          )}
        </>
      )}

      {openConcept ? (
        <ConceptDrawer
          key={openConcept.id}
          concept={openConcept}
          onClose={() => {
            setOpenConcept(null);
            void refresh();
          }}
          save={save}
        />
      ) : null}
    </div>
  );
}

function findConcept(
  subjects: SyllabusTree["subjects"],
  id?: string,
): ConceptVM | null {
  if (!id) return null;
  for (const s of subjects)
    for (const ch of s.chapters)
      for (const c of ch.concepts)
        if (c.id === id) return c;
  return null;
}