"use client";

import { useMemo, useState } from "react";
import type { HeatmapCell } from "@/types/syllabus";

const LEVELS = [
  "bg-line/60",
  "bg-emerald-900/60",
  "bg-emerald-700/80",
  "bg-emerald-500/90",
  "bg-emerald-400",
];

function levelFor(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

export function RevisionHeatmap({
  cells,
  onSelectDate,
}: {
  cells: HeatmapCell[];
  onSelectDate?: (date: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const weeks: HeatmapCell[][] = useMemo(() => {
    const result: HeatmapCell[][] = [];
    // The API emits 16*7 Sun→Sat weeks; chunk into weeks starting Sunday.
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [cells]);

  const total = cells.reduce((s, c) => s + c.count, 0);
  const activeDays = cells.filter((c) => c.count > 0).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted">{activeDays} active days · {total} revisions</p>
        <div className="flex items-center gap-1 text-[10px] text-muted">
          Less
          {LEVELS.map((cls) => (
            <span key={cls} className={`h-2.5 w-2.5 rounded-[3px] ${cls}`} />
          ))}
          More
        </div>
      </div>
      <div
        className="flex gap-[3px] overflow-x-auto pb-2"
        role="img"
        aria-label="Revision heatmap for the last 16 weeks"
      >
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((cell) => {
              const level = levelFor(cell.count);
              const isSel = selected === cell.date;
              return (
                <button
                  key={cell.date}
                  onClick={() => {
                    setSelected(isSel ? null : cell.date);
                    onSelectDate?.(cell.date);
                  }}
                  title={`${cell.date}: ${cell.count} ${cell.count === 1 ? "revision" : "revisions"}`}
                  aria-label={`${cell.date}: ${cell.count} revisions`}
                  aria-pressed={isSel}
                  className={`h-2.5 w-2.5 rounded-[3px] transition ${
                    LEVELS[level]
                  } ${
                    isSel
                      ? "ring-1 ring-apex ring-offset-1 ring-offset-[#12111a]"
                      : ""
                  } ${level === 0 ? "hover:bg-line" : "hover:brightness-125"}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}