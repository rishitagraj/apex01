"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { ArrowRight, Check, Flame, Users, Trophy, Clock3 } from "lucide-react";
import { Wordmark } from "@/components/brand";

const LINE_ONE = ["Plan.", "Focus."];
const LINE_TWO = ["Study", "together."];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const word = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function Headline() {
  const reduce = useReducedMotion();
  const variants = reduce ? undefined : container;

  const renderWords = (line: string[], className: string) =>
    line.map((w, i) => (
      <motion.span
        key={`${w}-${i}`}
        variants={word}
        className={`inline-block ${className}`}
      >
        {w}
        {i < line.length - 1 ? "\u00A0" : ""}
      </motion.span>
    ));

  return (
    <motion.h1
      variants={variants}
      initial={reduce ? false : "hidden"}
      animate="show"
      className="mx-auto max-w-4xl text-balance text-[2.75rem] font-bold leading-[1.04] tracking-tight sm:text-6xl md:text-7xl"
    >
      {renderWords(LINE_ONE, "")}
      <br />
      {renderWords(LINE_TWO, "text-gradient")}
    </motion.h1>
  );
}

const MOCK_TASKS = [
  { label: "Finish World War II notes", pri: "high" },
  { label: "Biology — revision ch. 5", pri: "medium" },
  { label: "Math assignment 3", pri: "medium" },
];

function PomodoroDial() {
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" strokeWidth="7" className="stroke-line/70" />
        <motion.circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          pathLength={1}
          className="stroke-apex2"
          strokeWidth="7"
          strokeLinecap="round"
          animate={{ strokeDashoffset: [0.85, 0.36, 0.85] }}
          transition={{ repeat: Infinity, duration: 9, ease: "easeInOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold tabular-nums">25:00</span>
        <span className="text-[10px] text-muted">in flow</span>
      </div>
    </div>
  );
}

function MockDashboard() {
  const [done, setDone] = useState([true, false, false]);

  useEffect(() => {
    const id = setInterval(() => {
      setDone((d) => {
        const i = d.findIndex((v) => !v);
        if (i === -1) return [false, false, true];
        const next = [...d];
        next[i] = true;
        return next;
      });
    }, 2400);
    return () => clearInterval(id);
  }, []);

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 140, damping: 16 });
  const sry = useSpring(ry, { stiffness: 140, damping: 16 });

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ry.set(px * 10);
    rx.set(-py * 8);
  }

  return (
    <motion.div
      className="relative mx-auto mt-16 w-full max-w-4xl px-2 perspective-[1200px] sm:px-4"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
      onPointerMove={onMove}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      <div className="pointer-events-none absolute -inset-10 rounded-[3rem] bg-apex-gradient opacity-20 blur-[80px]" />

      <motion.div
        style={{ rotateX: srx, rotateY: sry, transformStyle: "preserve-3d" }}
        className="relative overflow-hidden rounded-2xl border border-line bg-card/95 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-apex2/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-apex/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
            </div>
            <span className="text-xs font-medium text-muted">apex01 · dashboard</span>
          </div>
          <div className="chip">
            <Flame size={12} className="text-apex" />
            streak <span className="font-semibold text-foreground">×5</span>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-[1.15fr_auto]">
          <div className="rounded-xl border border-line bg-surface/60 p-4">
            <p className="mb-3 text-xs font-medium text-muted">Today — 3 tasks</p>
            <div className="space-y-2.5">
              {MOCK_TASKS.map((t, i) => {
                const checked = done[i];
                return (
                  <div
                    key={t.label}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md transition-colors duration-300 ${
                          checked ? "bg-apex-gradient text-white" : "border border-line"
                        }`}
                      >
                        {checked ? <Check size={11} strokeWidth={3} /> : null}
                      </span>
                      <span className={`truncate ${checked ? "text-muted line-through" : ""}`}>
                        {t.label}
                      </span>
                    </div>
                    {t.pri === "high" ? (
                      <span className="shrink-0 rounded-full bg-apex/15 px-2 py-0.5 text-[10px] font-semibold text-apex">
                        HIGH
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex w-full flex-row items-center justify-around gap-3 rounded-xl border border-line bg-surface/60 p-4 sm:w-auto sm:flex-col sm:justify-center">
            <PomodoroDial />
            <div className="space-y-1.5 text-center sm:text-left">
              <p className="text-xs font-medium text-muted">Sessions today</p>
              <div className="flex justify-center gap-1 sm:justify-start">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-6 rounded-full bg-apex-gradient"
                    style={{ opacity: i === 2 ? 0.35 : 1 }}
                  />
                ))}
              </div>
              <p className="text-xs text-muted">+2h 14m focused</p>
            </div>
          </div>
        </div>

        <div className="border-t border-line px-5 py-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium text-muted">Focus, this week</p>
              <p className="mt-0.5 text-lg font-bold">
                18<span className="text-gradient">h 24m</span>
              </p>
            </div>
            <span className="chip">
              <Trophy size={12} className="text-apex" /> top 1% this week
            </span>
          </div>
          <svg viewBox="0 0 600 60" className="mt-3 h-14 w-full" preserveAspectRatio="none">
            <path
              d="M0 48 C50 44 70 30 110 36 S170 52 210 40 S280 18 320 26 S390 46 430 30 S510 10 600 8"
              fill="none"
              strokeWidth="2.5"
              className="stroke-muted/40"
              strokeDasharray="4 5"
            />
            <motion.path
              d="M0 48 C50 44 70 30 110 36 S170 52 210 40 S280 18 320 26 S390 46 430 30 S510 10 600 8"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              className="stroke-apex"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 1.2, duration: 2, ease: "easeInOut" }}
            />
            <motion.circle
              cx="600"
              cy="8"
              r="4"
              className="fill-apex2"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1] }}
              transition={{ delay: 3, times: [0, 0.2, 1], repeat: Infinity }}
            />
          </svg>
        </div>
      </motion.div>

      <div className="float-chip absolute -left-8 top-8 hidden -rotate-6 rounded-xl border border-line bg-card px-3 py-2 shadow-xl sm:block" style={{ animationDuration: "6s" }}>
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <Flame size={14} className="text-apex" /> 5-day streak
        </p>
        <p className="mt-0.5 text-[10px] text-muted">2h 14m today · keep going</p>
      </div>

      <div className="float-chip absolute -right-10 top-1/3 hidden rotate-3 rounded-xl border border-line bg-card px-3 py-2 shadow-xl sm:block" style={{ animationDuration: "7s", animationDelay: "0.8s" }}>
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <Users size={14} className="text-apex" /> Room · M-4212
        </p>
        <p className="mt-0.5 text-[10px] text-muted">4 studying live right now</p>
      </div>

      <div className="float-chip absolute -bottom-6 left-1/4 hidden rounded-xl border border-line bg-card px-3 py-2 shadow-xl sm:block" style={{ animationDuration: "8s", animationDelay: "1.4s" }}>
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <Clock3 size={14} className="text-apex2" /> 24:11
        </p>
        <p className="mt-0.5 text-[10px] text-muted">focus session · break at 25:00</p>
      </div>
    </motion.div>
  );
}

export function LandingHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 text-center sm:px-6 sm:pt-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-apex/30 bg-apex/10 px-4 py-1.5 text-xs font-medium text-apex"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-apex opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-apex" />
        </span>
        Version 1.0 — build your study empire
      </motion.div>

      <div className="relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Headline />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-6 max-w-xl text-balance text-base text-muted sm:text-lg"
        >
          Apex01 is your all-in-one study command center — a{" "}
          <span className="font-medium text-foreground">planner</span>, a{" "}
          <span className="font-medium text-foreground">graphic Pomodoro</span>, live{" "}
          <span className="font-medium text-foreground">video focus rooms</span> and a global{" "}
          <span className="font-medium text-foreground">leaderboard</span>. Every minute counts.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link
            href={signedIn ? "/dashboard" : "/signup"}
            className="btn btn-primary btn-shine h-12 px-8 text-base"
          >
            <Users size={18} /> {signedIn ? "Open your dashboard" : "Start studying free"}
            <ArrowRight size={16} />
          </Link>
          <Link href="/leaderboard" className="btn h-12 px-8 text-base">
            View leaderboard <Trophy size={16} />
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="mt-4 text-xs text-muted"
        >
          Free forever. No card. No distractions.
        </motion.p>
      </div>

      <MockDashboard />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mx-auto mt-14 inline-flex flex-wrap items-center justify-center gap-2 text-xs text-muted"
      >
        <span className="inline-flex items-center gap-1.5">
          <Wordmark className="[&_span]:!text-xs [&_svg]:!size-4" />
        </span>
        <span>·</span>
        <span>Open source</span>
        <span>·</span>
        <span>Runs in your browser</span>
        <span>·</span>
        <span>Built for focused minds</span>
      </motion.div>
    </section>
  );
}