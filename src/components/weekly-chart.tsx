"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Flame } from "lucide-react";
import { formatMinutes } from "@/components/ui";

type Day = { date: string; minutes: number };

function parseKey(key: string): Date | null {
  const date = new Date(`${key}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function weekdayShort(key: string): string {
  return (
    parseKey(key)?.toLocaleDateString(undefined, { weekday: "short" }) ?? ""
  );
}

function dayOfMonth(key: string): string {
  return String(parseKey(key)?.getDate() ?? "");
}

function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Rounds the y-axis up to a friendly value so gridline labels stay readable. */
function niceMax(minutes: number): number {
  if (minutes <= 20) return 20;
  if (minutes <= 40) return 40;
  if (minutes <= 60) return 60;
  if (minutes <= 90) return 90;
  if (minutes <= 120) return 120;
  return Math.ceil(minutes / 60) * 60;
}

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
        // keep the last known values
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [initial]);

  const total = useMemo(
    () => days.reduce((sum, day) => sum + day.minutes, 0),
    [days],
  );
  const bestDay = useMemo(
    () =>
      days.reduce<Day | null>(
        (best, day) => (!best || day.minutes > best.minutes ? day : best),
        null,
      ),
    [days],
  );
  const hasData = total > 0;
  const scaleMax = niceMax(
    Math.max(...days.map((day) => day.minutes), 0),
  );
  const todayKey = localDateKey(new Date());

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 size={16} className="text-apex" />
            Weekly focus
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Study minutes logged from Pomodoro sessions.
          </p>
        </div>
        <span className="chip border-apex/30 bg-apex/10 text-apex">
          <Flame size={12} />
          {formatMinutes(total)} this week
        </span>
      </div>

      {!hasData ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/40 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-apex/10 text-apex">
            <BarChart3 size={22} />
          </span>
          <p className="mt-3 text-sm font-semibold">
            No focus time logged this week
          </p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
            Complete a Pomodoro session and your daily minutes will show up
            here automatically.
          </p>
          <Link href="/pomodoro" className="btn btn-primary btn-sm mt-4">
            Start a focus session
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-5 flex gap-2 sm:gap-3">
            <div
              aria-hidden
              className="flex h-36 shrink-0 flex-col justify-between text-right text-[10px] leading-none tabular-nums text-muted sm:h-40"
            >
              <span>{scaleMax}m</span>
              <span>{Math.round(scaleMax / 2)}m</span>
              <span>0m</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="relative h-36 sm:h-40">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-full"
                >
                  <div className="absolute inset-x-0 top-0 border-t border-dashed border-line/60" />
                  <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line/60" />
                  <div className="absolute inset-x-0 bottom-0 border-t border-line" />
                </div>

                <ul className="relative flex h-full items-end gap-1.5 sm:gap-2">
                  {days.map((day) => {
                    const isToday = day.date === todayKey;
                    const pct = Math.min(
                      100,
                      (day.minutes / scaleMax) * 100,
                    );
                    const label = `${weekdayShort(day.date)} ${dayOfMonth(
                      day.date,
                    )}`;
                    return (
                      <li
                        key={day.date}
                        className="flex h-full flex-1 items-end justify-center"
                      >
                        <div
                          tabIndex={0}
                          aria-label={`${label}: ${
                            day.minutes > 0
                              ? formatMinutes(day.minutes)
                              : "no focus logged"
                          }`}
                          className="group relative flex h-full w-full items-end justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-apex/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                        >
                          <span
                            className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-card px-2 py-1 text-[10px] font-semibold text-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                            style={{ bottom: `calc(${pct}% + 8px)` }}
                          >
                            {day.minutes > 0
                              ? formatMinutes(day.minutes)
                              : "No focus"}
                          </span>
                          <div
                            className="w-full max-w-8 rounded-t-md transition-all duration-500"
                            style={{
                              height: `${pct}%`,
                              minHeight: day.minutes > 0 ? 6 : 3,
                              background:
                                day.minutes > 0
                                  ? "linear-gradient(100deg, var(--apex), var(--apex2))"
                                  : "var(--line)",
                              opacity:
                                day.minutes > 0 ? (isToday ? 1 : 0.8) : 0.8,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div aria-hidden className="mt-2 flex gap-1.5 sm:gap-2">
                {days.map((day) => {
                  const isToday = day.date === todayKey;
                  return (
                    <div
                      key={day.date}
                      className="flex flex-1 flex-col items-center gap-0.5"
                    >
                      <span
                        className={`text-[10px] font-medium uppercase tracking-wide ${
                          isToday ? "text-apex" : "text-muted"
                        }`}
                      >
                        {weekdayShort(day.date)}
                      </span>
                      <span
                        className={`text-[10px] tabular-nums ${
                          isToday
                            ? "font-semibold text-foreground"
                            : "text-muted"
                        }`}
                      >
                        {dayOfMonth(day.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted">
                This week
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                {formatMinutes(total)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted">
                Daily average
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                {formatMinutes(Math.round(total / Math.max(days.length, 1)))}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted">
                Best day
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">
                {bestDay && bestDay.minutes > 0
                  ? `${weekdayShort(bestDay.date)} · ${formatMinutes(
                      bestDay.minutes,
                    )}`
                  : "—"}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
