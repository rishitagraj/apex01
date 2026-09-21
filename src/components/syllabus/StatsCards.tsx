"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

function AnimatedNumber({
  value,
  className = "",
  suffix = "",
}: {
  value: number;
  className?: string;
  suffix?: string;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(() => (reduced ? value : 0));
  const prev = useRef(0);

  useEffect(() => {
    if (reduced) {
      prev.current = value;
      return;
    }
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    const controls = animate(from, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduced]);

  return (
    <span className={`tabular-nums ${className}`}>
      {display}
      {suffix}
    </span>
  );
}

export function StatsCards({
  conceptsCompleted,
  totalConcepts,
  coverage,
  needsRevision,
  streakDays,
  weakCount,
  masteredCount,
}: {
  conceptsCompleted: number;
  totalConcepts: number;
  coverage: number;
  needsRevision: number;
  streakDays: number;
  weakCount: number;
  masteredCount: number;
}) {
  const cards = [
    {
      label: "Concepts Completed",
      value: totalConcepts ? conceptsCompleted : 0,
      suffix: totalConcepts ? ` / ${totalConcepts}` : "",
      hint: `${masteredCount} mastered`,
      icon: "✓",
      accent: "from-emerald-500/20 to-emerald-500/0 text-emerald-300",
      ring: "ring-emerald-500/20",
    },
    {
      label: "Overall Coverage",
      value: coverage,
      suffix: "%",
      hint: "checklist + confidence",
      icon: "◔",
      accent: "from-apex/25 to-apex2/0 text-apex",
      ring: "ring-apex/20",
    },
    {
      label: "Needs Revision",
      value: needsRevision,
      suffix: " concepts",
      hint: `${weakCount} weak`,
      icon: "↻",
      accent: "from-amber-500/20 to-amber-500/0 text-amber-300",
      ring: "ring-amber-500/20",
    },
    {
      label: "Current Study Streak",
      value: streakDays,
      suffix: " days",
      hint: "revision days in a row",
      icon: "🔥",
      accent: "from-purple-500/20 to-purple-500/0 text-purple-300",
      ring: "ring-purple-500/20",
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`card relative flex flex-col gap-1 overflow-hidden rounded-3xl p-5 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40 ${card.ring}`}
          style={{ backdropFilter: "blur(12px)" }}
        >
          <div
            className={`pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-gradient-to-br blur-2xl ${card.accent}`}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">{card.label}</p>
            <span className="text-lg leading-none opacity-80">{card.icon}</span>
          </div>
          <p className="text-3xl font-extrabold tracking-tight">
            <AnimatedNumber value={card.value} suffix={card.suffix} />
          </p>
          <p className="text-[11px] text-muted">{card.hint}</p>
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.04] to-transparent" />
        </div>
      ))}
    </div>
  );
}