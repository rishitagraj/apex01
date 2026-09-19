"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { LandingHero } from "./landing-hero";
import { LandingSections, type LandingStats } from "./landing-sections";

export function LandingPage({
  signedIn,
  stats,
}: {
  signedIn: boolean;
  stats: LandingStats;
}) {
  return (
    <main className="relative flex-1 overflow-x-clip">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="aurora-blob absolute -top-48 left-1/2 h-[600px] w-[860px] -translate-x-1/2 rounded-full bg-apex/20 blur-[140px]" />
        <div
          className="aurora-blob absolute right-[-12%] top-[24%] h-[400px] w-[400px] rounded-full bg-apex2/20 blur-[130px]"
          style={{ animationDelay: "-8s", animationDuration: "26s" }}
        />
        <div
          className="aurora-blob absolute left-[-10%] top-[68%] h-[440px] w-[440px] rounded-full bg-apex/15 blur-[140px]"
          style={{ animationDelay: "-14s", animationDuration: "30s" }}
        />
        <div className="landing-grid absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent to-background" />
      </div>

      <header className="sticky top-3 z-40 mx-auto w-[min(100%-1.5rem,72rem)]">
        <nav className="flex items-center justify-between gap-3 rounded-2xl border border-line/80 bg-card/70 px-4 py-2.5 backdrop-blur-xl">
          <Link href="/" aria-label="Apex01 — home">
            <Wordmark />
          </Link>

          <div className="hidden items-center gap-1 text-sm text-muted md:flex">
            <a
              href="#features"
              className="rounded-lg px-3 py-1.5 transition hover:bg-surface hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#how"
              className="rounded-lg px-3 py-1.5 transition hover:bg-surface hover:text-foreground"
            >
              How it works
            </a>
            <Link
              href="/leaderboard"
              className="rounded-lg px-3 py-1.5 transition hover:bg-surface hover:text-foreground"
            >
              Leaderboard
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost hidden sm:inline-flex">
              Sign in
            </Link>
            <Link
              href={signedIn ? "/dashboard" : "/signup"}
              className="btn btn-primary btn-shine"
            >
              {signedIn ? "Dashboard" : "Get started"}
              <ArrowRight size={15} />
            </Link>
          </div>
        </nav>
      </header>

      <LandingHero signedIn={signedIn} />
      <LandingSections stats={stats} />

      <footer className="relative border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted sm:flex-row">
          <Wordmark />
          <div className="flex items-center gap-5">
            <Link href="/leaderboard" className="transition hover:text-foreground">
              Leaderboard
            </Link>
            <Link href="/login" className="transition hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className="transition hover:text-foreground">
              Create account
            </Link>
          </div>
          <p>© {new Date().getFullYear()} Apex01. Built for focused minds.</p>
        </div>
      </footer>
    </main>
  );
}