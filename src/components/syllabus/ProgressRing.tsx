"use client";

import { motion, useReducedMotion } from "motion/react";

export function ProgressRing({
  value,
  size = 88,
  stroke = 8,
  label,
  className = "",
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = c - (clamped / 100) * c;

  const color =
    clamped >= 90
      ? "text-emerald-400"
      : clamped >= 50
        ? "text-apex"
        : clamped > 0
          ? "text-amber-400"
          : "text-muted";

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ? `${label}: ${clamped}%` : `${clamped}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          className="text-line opacity-60"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          className={color}
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{
            duration: reduced ? 0 : 1,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-bold tabular-nums ${color}`}>
          {Math.round(clamped)}%
        </span>
      </span>
    </div>
  );
}