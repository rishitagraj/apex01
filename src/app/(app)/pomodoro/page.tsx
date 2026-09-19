import type { Metadata } from "next";
import { Pomodoro } from "@/components/pomodoro";
import { CalculatorToggle } from "@/components/calculator";

export const metadata: Metadata = { title: "Pomodoro" };

export default function PomodoroPage() {
  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Pomodoro</h1>
        <p className="mt-1 text-sm text-muted">
          Focus for 25 minutes, breathe, then go again. Your streak builds automatically.
        </p>
      </header>

      <div className="flex justify-center">
        <Pomodoro />
      </div>

      <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-card p-5 text-center">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          How it works
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Pick a mode, press start. The ring visually drains as time passes and a soft chime
          tells you when a session finishes. Completing a focus session automatically rolls
          into a break — after every fourth one you get a longer reset.
        </p>
      </div>

      <div className="mx-auto w-full max-w-md">
        <CalculatorToggle />
      </div>
    </div>
  );
}