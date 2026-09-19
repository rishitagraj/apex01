"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Gauge,
  ListTodo,
  PenLine,
  Video,
  Users,
} from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

const MARQUEE_ITEMS = [
  "Graphic Pomodoro",
  "To-do planner",
  "Scribble to text",
  "Focus rooms",
  "Leaderboard",
  "Streak tracking",
  "Timetable",
  "Assessments",
];

function Marquee() {
  const row = MARQUEE_ITEMS.map((item) => (
    <span key={item} className="flex items-center gap-6 pr-6 text-sm font-medium text-muted">
      <span className="whitespace-nowrap">{item}</span>
      <span className="text-apex">✦</span>
    </span>
  ));
  return (
    <section className="relative border-y border-line bg-surface/40 py-5">
      <div className="marquee overflow-hidden">
        <div className="marquee-track flex w-max">
          <div className="flex items-center">{row}</div>
          <div className="flex items-center" aria-hidden="true">
            {row}
          </div>
        </div>
      </div>
    </section>
  );
}

type Feature = {
  icon: typeof Gauge;
  title: string;
  desc: string;
};

const FEATURES: Feature[] = [
  {
    icon: Gauge,
    title: "Graphic Pomodoro",
    desc: "Focus and break cycles with a satisfying animated timer. Every completed session is banked automatically.",
  },
  {
    icon: ListTodo,
    title: "Weekly planner",
    desc: "To-dos with priorities, due dates and notes. Map your whole week in one place instead of juggling tabs.",
  },
  {
    icon: CalendarDays,
    title: "Timetable",
    desc: "Build a reusable weekly schedule — add subjects, slots and notes, then study the same rhythm every week.",
  },
  {
    icon: ClipboardList,
    title: "Assessments",
    desc: "Track exams, quizzes, assignments and projects with their weight and a readiness status as you study.",
  },
  {
    icon: Video,
    title: "Live focus rooms",
    desc: "Join a room with a code and study together over real video — your minutes count on the leaderboard.",
  },
  {
    icon: PenLine,
    title: "Scribble to text",
    desc: "Jot a task by hand on your iPad or pen tablet and watch it become real text — on-device, with cloud OCR for cursive.",
  },
];

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      variants={{
        hidden: { opacity: 0, y: 28 },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
      }}
      className="card group relative overflow-hidden p-6 transition-colors hover:border-apex/30"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(260px circle at var(--mx) var(--my), color-mix(in srgb, var(--apex) 14%, transparent), transparent 70%)",
        }}
      />
      <div className="relative">
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-apex-gradient shadow-lg shadow-apex/20 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
          <Icon size={20} className="text-white" />
        </div>
        <h3 className="text-lg font-semibold">{feature.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{feature.desc}</p>
      </div>
    </motion.div>
  );
}

function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="mb-12 text-center"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-apex">
          One command center
        </p>
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          Everything you need to <span className="text-gradient">actually study</span>
        </h2>
      </motion.div>

      <motion.div
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} feature={f} />
        ))}
      </motion.div>
    </section>
  );
}

export type LandingStats = {
  users: number;
  minutes: number;
  rooms: number;
  tasks: number;
};

type Stat = {
  value: number;
  label: string;
  compact?: boolean;
};

function buildStats(stats: LandingStats): Stat[] {
  return [
    { value: stats.users, label: "Students on Apex01" },
    {
      value: stats.minutes,
      label: "Minutes of focus tracked",
      compact: stats.minutes >= 1_000_000,
    },
    { value: stats.rooms, label: "Study rooms hosted" },
    { value: stats.tasks, label: "Tasks planned" },
  ];
}

function formatStat(x: number, compact: boolean, decimals: number) {
  if (compact) {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: decimals,
    }).format(x);
  }
  return Math.round(x).toLocaleString("en");
}

function StatCard({
  stat,
  index,
}: {
  stat: Stat;
  index: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const v = useMotionValue(0);
  const decimals = stat.compact ? 1 : 0;

  useEffect(() => {
    if (!inView) return;
    const roundFor = (x: number) => (stat.compact ? x : Math.round(x));
    if (reduce) {
      if (ref.current)
        ref.current.textContent = formatStat(roundFor(v.get()), stat.compact === true, decimals);
      return;
    }
    const controls = animate(v, stat.value, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        if (ref.current)
          ref.current.textContent = formatStat(roundFor(latest), stat.compact === true, decimals);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, stat.value, v]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: EASE }}
      className="text-center"
    >
      <p className="text-gradient text-4xl font-bold tracking-tight sm:text-5xl">
        <span ref={ref}>0</span>
      </p>
      <p className="mt-2 text-sm text-muted">{stat.label}</p>
    </motion.div>
  );
}

function Stats({ stats }: { stats: LandingStats }) {
  const list = buildStats(stats);
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6">
      <div className="card relative overflow-hidden p-8 sm:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-apex/15 blur-[90px]" />
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {list.map((s, i) => (
            <StatCard key={s.label} stat={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    num: "01",
    title: "Plan your week",
    desc: "Tasks, a timetable and assessment dates — everything mapped into clear days, not scattered tabs.",
  },
  {
    num: "02",
    title: "Focus & flow",
    desc: "Pair graphic Pomodoro sessions with live focus rooms. Other people grinding keeps you honest.",
  },
  {
    num: "03",
    title: "Compete & streak",
    desc: "Watch your weekly chart grow, keep streaks alive and climb the global leaderboard with every minute.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 pb-24 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="mb-12 text-center"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-apex">
          Dead simple
        </p>
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          Three steps to <span className="text-gradient">your empire</span>
        </h2>
      </motion.div>

      <div className="relative grid gap-6 md:grid-cols-3">
        <div className="pointer-events-none absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-transparent via-line to-transparent md:block" />
        {STEPS.map((step, i) => (
          <motion.div
            key={step.num}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: i * 0.12, ease: EASE }}
            className="card relative p-6"
          >
            <span className="text-gradient text-4xl font-bold tracking-tight">{step.num}</span>
            <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-28 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative"
      >
        <div className="absolute -inset-px overflow-hidden rounded-3xl">
          <div
            className="absolute inset-[-50%] opacity-70"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, var(--apex) 60deg, var(--apex2) 120deg, transparent 180deg, var(--apex) 240deg, var(--apex2) 300deg, transparent 360deg)",
              animation: "spin-slow 8s linear infinite",
            }}
          />
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-line bg-card/95 p-10 text-center backdrop-blur sm:p-16">
          <div className="aurora-blob pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-apex/20 blur-[100px]" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-apex">
            Today&apos;s the day
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            Your empire starts with <span className="text-gradient">25 minutes</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-balance text-muted">
            Invite a friend, claim a room code, and get one focus session under your belt tonight.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn btn-primary btn-shine h-12 px-8 text-base">
              <Users size={18} /> Start studying free
              <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="btn h-12 px-8 text-base">
              I already have an account
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

export function LandingSections({ stats }: { stats: LandingStats }) {
  return (
    <>
      <Marquee />
      <Features />
      <Stats stats={stats} />
      <HowItWorks />
      <FinalCta />
    </>
  );
}