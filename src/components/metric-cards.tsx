"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animate, motion, useReducedMotion } from "motion/react";
import {
  Timer,
  CheckCircle2,
  CircleDashed,
  Trophy,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { formatMinutes } from "@/components/ui";

function CountUp({
  value,
  prefix = "",
  suffix = "",
  format,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
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

  const shown = reduced ? value : display;

  return (
    <span className="tabular-nums">
      {prefix}
      {format ? format(shown) : shown}
      {suffix}
    </span>
  );
}

interface Metric {
  label: string;
  icon: LucideIcon;
  value?: string;
  numeric?: number;
  prefix?: string;
  format?: (n: number) => string;
  hint: string;
  href: string;
  chip: string;
  bar: string;
}

export function MetricCards({
  focusMinutes,
  completedToday,
  pendingToday,
  rank,
}: {
  focusMinutes: number;
  completedToday: number;
  pendingToday: number;
  rank: number | null;
}) {
  const reduced = useReducedMotion();
  const totalTasks = completedToday + pendingToday;

  const metrics: Metric[] = [
    {
      label: "Focus time",
      icon: Timer,
      numeric: focusMinutes,
      format: formatMinutes,
      hint: "all-time Pomodoro focus",
      href: "/pomodoro",
      chip: "bg-apex/15 text-apex",
      bar: "from-apex to-apex2",
    },
    {
      label: "Completed today",
      icon: CheckCircle2,
      numeric: completedToday,
      hint:
        totalTasks > 0
          ? `of ${totalTasks} task${totalTasks === 1 ? "" : "s"} in your planner`
          : "tasks checked off",
      href: "/todos",
      chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      bar: "from-emerald-400 to-teal-500",
    },
    {
      label: "Open tasks",
      icon: CircleDashed,
      numeric: pendingToday,
      hint:
        pendingToday > 0
          ? "still waiting in your planner"
          : "you're all caught up",
      href: "/todos",
      chip: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
      bar: "from-indigo-400 to-violet-500",
    },
    {
      label: "Global rank",
      icon: Trophy,
      value: rank ? `#${rank}` : "—",
      numeric: rank ?? undefined,
      prefix: "#",
      hint: rank ? "by focus minutes" : "finish a session to rank",
      href: "/leaderboard",
      chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      bar: "from-amber-300 to-orange-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {metrics.map((metric, i) => {
        const Icon = metric.icon;
        return (
          <motion.div
            key={metric.label}
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: i * 0.07,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="h-full"
          >
            <Link
              href={metric.href}
              className="card group relative flex h-full flex-col overflow-hidden rounded-2xl p-4 transition duration-300 hover:-translate-y-1 hover:border-apex/40 hover:shadow-lg hover:shadow-black/10 sm:p-5"
            >
              <span
                aria-hidden
                className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-60 transition-opacity duration-300 group-hover:opacity-100 ${metric.bar}`}
              />

              <div className="flex items-start justify-between gap-2">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset ring-white/5 sm:h-10 sm:w-10 ${metric.chip}`}
                >
                  <Icon size={17} />
                </span>
                <ArrowUpRight
                  size={16}
                  className="mt-0.5 shrink-0 text-muted transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-apex"
                />
              </div>

              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:text-[11px]">
                {metric.label}
              </p>
              <p className="mt-0.5 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                {metric.numeric !== undefined ? (
                  <CountUp
                    value={metric.numeric}
                    prefix={metric.prefix ?? ""}
                    format={metric.format}
                  />
                ) : (
                  metric.value
                )}
              </p>
              <p className="mt-auto pt-1.5 text-[10px] leading-snug text-muted sm:text-[11px]">
                {metric.hint}
              </p>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
