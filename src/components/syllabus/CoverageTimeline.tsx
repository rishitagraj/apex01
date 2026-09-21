"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { TimelinePoint } from "@/types/syllabus";

const RANGES = [7, 30, 90, 365] as const;
const W = 560;
const H = 150;
const PAD_X = 36;
const PAD_Y = 18;

export function CoverageTimeline({
  points,
}: {
  points: TimelinePoint[];
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [now] = useState(() => Date.now());

  const series = useMemo(() => {
    const cutoff = now - range * 24 * 60 * 60 * 1000;
    const filtered = points.filter((p) => new Date(p.date).getTime() >= cutoff);
    return filtered.length
      ? filtered
      : [{ date: new Date(now).toISOString().slice(0, 10), revisedCumulative: 0, totalConcepts: 0 }];
  }, [points, range, now]);

  const maxY = useMemo(
    () => Math.max(1, ...series.map((p) => p.revisedCumulative), ...series.map((p) => p.totalConcepts || 0)),
    [series],
  );

  const coords = useMemo(() => {
    const n = Math.max(1, series.length);
    return series.map((p, i) => ({
      x: PAD_X + (i / Math.max(1, n - 1)) * (W - PAD_X * 2),
      y: H - PAD_Y - (p.revisedCumulative / maxY) * (H - PAD_Y * 2),
      ...p,
    }));
  }, [series, maxY]);

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1]?.x ?? 0} ${H - PAD_Y} L ${coords[0]?.x ?? 0} ${H - PAD_Y} Z`;

  const last = coords[coords.length - 1];
  const coverage = last
    ? last.totalConcepts
      ? Math.round((last.revisedCumulative / last.totalConcepts) * 100)
      : 0
    : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`chip transition ${
                range === r
                  ? "border-apex/50 bg-apex/15 font-semibold text-apex"
                  : "border-line bg-surface text-muted hover:text-foreground"
              }`}
            >
              {r}D
            </button>
          ))}
        </div>
        <p className="text-sm font-medium text-muted">
          Coverage <span className="font-bold tabular-nums text-apex">{coverage}%</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          className="max-w-none"
          role="img"
          aria-label="Cumulative syllabus coverage timeline"
        >
          <defs>
            <linearGradient id="cvt-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff7a1a" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="cvt-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ff7a1a" />
              <stop offset="100%" stopColor="#ff3d6e" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={PAD_Y + f * (H - PAD_Y * 2)}
              y2={PAD_Y + f * (H - PAD_Y * 2)}
              stroke="#2a2a38"
              strokeDasharray="3 5"
            />
          ))}
          <path d={areaPath} fill="url(#cvt-fill)" />
          <motion.path
            d={linePath}
            fill="none"
            stroke="url(#cvt-line)"
            strokeWidth={2.5}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          {last ? (
            <motion.circle
              cx={last.x}
              cy={last.y}
              r={4}
              fill="#ff7a1a"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.9, type: "spring", stiffness: 300 }}
            />
          ) : null}
        </svg>
      </div>
      <div className="flex justify-between text-[10px] text-muted">
        <span>{new Date(series[0].date).toLocaleDateString()}</span>
        <span>{new Date(series[series.length - 1].date).toLocaleDateString()}</span>
      </div>
    </div>
  );
}