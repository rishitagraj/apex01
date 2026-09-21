"use client";

import { useMemo } from "react";
import { Search, ArrowUpDown, Tag, X } from "lucide-react";
import { STATUS_LABEL, STATUS_CHIP } from "@/components/syllabus/colors";
import {
  SYLLABUS_STATUSES,
  type SyllabusStatus,
} from "@/types/syllabus";
import type { SubjectVM } from "@/types/syllabus";

export type SortKey = "order" | "name" | "coverage" | "recent";

export interface SyllabusFilters {
  subject: string;
  classLevel: string;
  status: "all" | SyllabusStatus;
  search: string;
  sort: SortKey;
  tag: "all" | string;
}

export const DEFAULT_FILTERS: SyllabusFilters = {
  subject: "all",
  classLevel: "all",
  status: "all",
  search: "",
  sort: "order",
  tag: "all",
};

export function FilterBar({
  subjects,
  availableTags,
  value,
  onChange,
  resultCount,
}: {
  subjects: SubjectVM[];
  availableTags: string[];
  value: SyllabusFilters;
  onChange: (next: SyllabusFilters) => void;
  resultCount: number;
}) {
  const classLevels = useMemo(
    () =>
      [...new Set(subjects.map((s) => s.classLevel).filter(Boolean))].sort() as string[],
    [subjects],
  );

  const active =
    value.subject !== "all" ||
    value.classLevel !== "all" ||
    value.status !== "all" ||
    value.tag !== "all" ||
    value.search.trim() !== "";

  return (
    <div className="sticky top-4 z-30 rounded-2xl border border-line bg-surface/80 p-3 backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-black/30 px-3 py-2 focus-within:border-apex/40">
          <Search size={15} className="shrink-0 text-muted" />
          <input
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder="Search concepts, chapters, tags…"
            aria-label="Search syllabus"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {value.search ? (
            <button
              onClick={() => onChange({ ...value, search: "" })}
              aria-label="Clear search"
              className="text-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:items-center">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <span className="sr-only">Subject</span>
            <select
              value={value.subject}
              onChange={(e) => onChange({ ...value, subject: e.target.value })}
              className="input w-full"
              aria-label="Filter by subject"
            >
              <option value="all">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-muted">
            <span className="sr-only">Class</span>
            <select
              value={value.classLevel}
              onChange={(e) => onChange({ ...value, classLevel: e.target.value })}
              className="input w-full"
              aria-label="Filter by class"
            >
              <option value="all">All classes</option>
              {classLevels.map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-muted">
            <span className="sr-only">Sort</span>
            <ArrowUpDown size={14} className="hidden sm:inline" />
            <select
              value={value.sort}
              onChange={(e) => onChange({ ...value, sort: e.target.value as SortKey })}
              className="input w-full"
              aria-label="Sort concepts"
            >
              <option value="order">Order</option>
              <option value="name">Name</option>
              <option value="coverage">Coverage</option>
              <option value="recent">Recently revised</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-muted">
            <span className="sr-only">Tag</span>
            <Tag size={14} className="hidden sm:inline" />
            <select
              value={value.tag}
              onChange={(e) => onChange({ ...value, tag: e.target.value })}
              className="input w-full"
              aria-label="Filter by tag"
            >
              <option value="all">All tags</option>
              {availableTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          {active ? (
            <button
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="chip border-apex/40 bg-apex/10 font-medium text-apex"
            >
              Clear ({resultCount})
            </button>
          ) : (
            <span className="hidden text-[11px] text-muted lg:inline">
              {resultCount} {resultCount === 1 ? "result" : "results"}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Status filter">
        <button
          onClick={() => onChange({ ...value, status: "all" })}
          className={`chip transition ${
            value.status === "all"
              ? "border-apex/50 bg-apex/15 font-semibold text-apex"
              : "border-line bg-surface text-muted hover:text-foreground"
          }`}
        >
          All
        </button>
        {SYLLABUS_STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => onChange({ ...value, status })}
            aria-pressed={value.status === status}
            className={`chip transition ${STATUS_CHIP[status]} ${
              value.status === status
                ? "font-semibold ring-1 ring-current"
                : "opacity-80 hover:opacity-100"
            }`}
          >
            {STATUS_LABEL[status]}
          </button>
        ))}
      </div>
    </div>
  );
}