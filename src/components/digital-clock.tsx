"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Live, local digital clock. Renders a placeholder on the server so there is
 * no hydration mismatch, then ticks once per second on the client. */
export function DigitalClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const hours = now?.getHours() ?? null;
  const hour12 = hours === null ? null : hours % 12 || 12;
  const ampm = hours === null ? "" : hours < 12 ? "AM" : "PM";

  const time = now
    ? `${pad(hour12!)}:${pad(now.getMinutes())}`
    : "--:--";
  const seconds = now ? pad(now.getSeconds()) : "--";

  const dateLabel = now
    ? now.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "—";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line/80 bg-surface/70 p-4 backdrop-blur-sm ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-apex/50 to-transparent"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          <Clock3 size={12} className="text-apex" />
          Local time
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70 dark:bg-emerald-400" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
          </span>
          Live
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-mono text-[2rem] font-bold leading-none tabular-nums tracking-tight sm:text-4xl">
          {time}
        </span>
        <span className="font-mono text-sm font-medium tabular-nums text-muted">
          :{seconds}
        </span>
        <span className="ml-1 text-xs font-semibold text-apex">{ampm}</span>
      </div>

      <p className="mt-1.5 text-[11px] text-muted">{dateLabel}</p>
    </div>
  );
}
