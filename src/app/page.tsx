import Link from "next/link";
import {
  ListTodo,
  Timer,
  Video,
  Trophy,
  ShieldCheck,
  Flame,
  ArrowRight,
  Users,
} from "lucide-react";
import { Wordmark, BrandMark } from "@/components/brand";
import { verifySession } from "@/lib/auth";

const FEATURES = [
  {
    icon: ListTodo,
    title: "Smart planner",
    desc: "A to-do list with priorities, due dates and notes — your whole week mapped out in one place.",
  },
  {
    icon: Timer,
    title: "Graphic Pomodoro",
    desc: "A beautiful animated focus timer with focus and break cycles that keep you in flow.",
  },
  {
    icon: Video,
    title: "Live focus rooms",
    desc: "Real video study rooms powered by open-source Jitsi Meet. Study together from anywhere.",
  },
  {
    icon: Trophy,
    title: "Leaderboard",
    desc: "Every minute in a focus room counts. Compete on hours and climb Apex01's global ranks.",
  },
  {
    icon: Flame,
    title: "Streaks & sessions",
    desc: "Track completed Pomodoro sessions and watch your weekly focus chart grow.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    desc: "Email + password auth with hashed credentials and signed, httpOnly session cookies.",
  },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = await verifySession();

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* glow decorations */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-apex/20 blur-[140px]" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-[300px] w-[300px] rounded-full bg-apex2/15 blur-[120px]" />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Wordmark />
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn btn-ghost">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary">
            Get started <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-apex/30 bg-apex/10 px-4 py-1.5 text-xs font-medium text-apex">
          <Flame size={14} />
          Version 1.0 — build your study empire
        </div>

        <h1 className="mx-auto max-w-3xl text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Plan. Focus.
          <br />
          <span className="text-gradient">Study together.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted">
          Apex01 is your all-in-one study command center — a planner, a graphic Pomodoro
          timer, live video focus rooms and a global leaderboard. Every minute counts.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={userId ? "/dashboard" : "/signup"} className="btn btn-primary h-12 px-8 text-base">
            <Users size={18} /> Start studying free
          </Link>
          <Link href="/leaderboard" className="btn h-12 px-8 text-base">
            View leaderboard <Trophy size={16} />
          </Link>
        </div>

        <div className="mx-auto mt-16 flex max-w-lg items-center justify-center gap-2 rounded-full border border-line bg-card/50 px-4 py-2 text-sm text-muted">
          <BrandMark size={20} />
          <span>
            Join with a room code and study alongside friends in seconds.
          </span>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card group p-6 transition hover:border-apex/30">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-apex-gradient shadow-lg shadow-apex/20 transition group-hover:scale-105">
                  <Icon size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="relative border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-muted sm:flex-row">
          <Wordmark />
          <p>© {new Date().getFullYear()} Apex01. Built for focused minds. No distractions.</p>
        </div>
      </footer>
    </main>
  );
}