"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { DigitalClock } from "@/components/digital-clock";

function greetingFor(hour: number) {
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export function DashboardHero({ name }: { name: string }) {
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    const update = () => setGreeting(greetingFor(new Date().getHours()));
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="card relative overflow-hidden rounded-3xl p-5 sm:p-7 lg:p-8">
      <div
        aria-hidden
        className="landing-grid pointer-events-none absolute inset-0 opacity-40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-28 h-60 w-60 rounded-full bg-apex/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 right-6 h-56 w-56 rounded-full bg-apex2/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-apex/60 to-transparent"
      />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-apex/25 bg-apex/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-apex">
            <Sparkles size={12} />
            {greeting}
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-[2.1rem] lg:leading-tight">
            Welcome back, <span className="text-gradient">{name}</span>
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
            Here&apos;s your day at a glance — a little focused work today keeps
            the momentum going.
          </p>
        </div>

        <DigitalClock className="w-full shrink-0 sm:w-80 lg:w-[21rem]" />
      </div>
    </section>
  );
}
