"use client";

import { useEffect, useState } from "react";

type Day = { date: string; minutes: number };

export function WeeklyChart({ initial }: { initial: Day[] }) {
  const [days, setDays] = useState<Day[]>(initial);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setDays(data.stats?.week ?? initial);
        }
      } catch {
        // ignore
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [initial]);

  const max = Math.max(...days.map((d) => d.minutes), 1);
  const labels = days.map((d) => {
    const [, m, day] = d.date.split("-");
    return `${m}/${day}`;
  });

  return (
    <div>
      <div className="flex h-36 items-end gap-2">
        {days.map((d, i) => {
          const h = Math.max((d.minutes / max) * 100, d.minutes > 0 ? 8 : 4);
          return (
            <div key={d.date} className="group flex flex-1 flex-col items-center gap-1.5">
              <div className="relative flex w-full max-w-9 flex-1 items-end">
                <div
                  className="w-full rounded-t-lg transition-all group-hover:opacity-100"
                  style={{
                    height: `${h}%`,
                    minHeight: 4,
                    background: "linear-gradient(100deg, #ff7a1a, #ff3d6e)",
                    opacity: d.minutes > 0 ? 0.85 : 0.15,
                  }}
                />
                <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-medium text-foreground opacity-0 shadow-md transition group-hover:opacity-100">
                  {d.minutes > 0 ? `${Math.round(d.minutes)}m` : "0"}
                </span>
              </div>
              <span className="text-[10px] text-muted">{labels[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}