"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  Flame,
  Coffee,
  Settings2,
  AlertTriangle,
} from "lucide-react";
import { Button, Input, Label } from "@/components/ui";

type Mode = "focus" | "short" | "long";

const MODES: Record<
  Mode,
  { label: string; icon: typeof Flame; color: string; gradFrom: string; gradTo: string }
> = {
  focus: { label: "Focus", icon: Flame, color: "#ff7a1a", gradFrom: "#ff7a1a", gradTo: "#ff3d6e" },
  short: { label: "Short break", icon: Coffee, color: "#22d3ee", gradFrom: "#22d3ee", gradTo: "#3b82f6" },
  long: { label: "Long break", icon: Coffee, color: "#a78bfa", gradFrom: "#a78bfa", gradTo: "#6366f1" },
};

const DEFAULT_MINUTES: Record<Mode, number> = { focus: 25, short: 5, long: 15 };
const MODE_ORDER: Mode[] = ["focus", "short", "long"];
const STORAGE_KEY = "apex01:pomodoros";
const DURATIONS_KEY = "apex01:pomodoro-minutes";
const TIMER_KEY = "apex01:pomodoro-timer";

type TimerSnapshot = {
  mode: Mode;
  secondsLeft: number;
  running: boolean;
  deadline: number | null;
};

function clamp(n: number | undefined, min = 1, max = 180): number {
  if (typeof n !== "number" || Number.isNaN(n)) return min;
  return Math.min(Math.max(Math.round(n), min), max);
}

function readDurations(): Record<Mode, number> {
  if (typeof window === "undefined") return DEFAULT_MINUTES;
  try {
    const raw = localStorage.getItem(DURATIONS_KEY);
    if (!raw) return DEFAULT_MINUTES;
    const parsed = JSON.parse(raw) as Partial<Record<Mode, number>>;
    return {
      focus: clamp(parsed.focus ?? DEFAULT_MINUTES.focus),
      short: clamp(parsed.short ?? DEFAULT_MINUTES.short),
      long: clamp(parsed.long ?? DEFAULT_MINUTES.long),
    };
  } catch {
    return DEFAULT_MINUTES;
  }
}

function readTimer(): TimerSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    return raw ? (JSON.parse(raw) as TimerSnapshot) : null;
  } catch {
    return null;
  }
}

function readCompletedFocus(): number {
  if (typeof window === "undefined") return 0;
  const stored = Number(localStorage.getItem(STORAGE_KEY) || 0);
  return Number.isNaN(stored) ? 0 : stored;
}

function beep() {
  try {
    const Ctx = window.AudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = i === 2 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.28);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.3);
    });
  } catch {
    // audio unavailable
  }
}

function notify(title: string, body: string) {
  try {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        const n = new Notification(title, { body, icon: "/icon.svg", tag: "apex01-pomodoro" });
        setTimeout(() => n.close(), 10_000);
      }
    }
  } catch {
    // notifications unavailable
  }
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function Pomodoro() {
  const [durations, setDurations] = useState<Record<Mode, number>>(readDurations);
  const [mode, setMode] = useState<Mode>(() => {
    const t = readTimer();
    return t && MODE_ORDER.includes(t.mode) ? t.mode : "focus";
  });
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const t = readTimer();
    if (t) {
      if (t.running && t.deadline != null && t.deadline > Date.now()) {
        return Math.max(Math.ceil((t.deadline - Date.now()) / 1000), 1);
      }
      return Math.max(t.secondsLeft, 1);
    }
    return DEFAULT_MINUTES.focus * 60;
  });
  const [running, setRunning] = useState(() => {
    const t = readTimer();
    return Boolean(t?.running && t.deadline != null && t.deadline > Date.now());
  });
  const [deadline, setDeadline] = useState<number | null>(() => {
    const t = readTimer();
    return t?.running && t.deadline != null && t.deadline > Date.now() ? t.deadline : null;
  });
  const [completedFocus, setCompletedFocus] = useState<number>(readCompletedFocus);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifState, setNotifState] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );

  const countRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(running);
  const deadlineRef = useRef<number | null>(deadline);
  const secondsLeftRef = useRef(secondsLeft);

  useEffect(() => {
    countRef.current = completedFocus;
  }, [completedFocus]);
  useEffect(() => {
    runningRef.current = running;
  }, [running]);
  useEffect(() => {
    deadlineRef.current = deadline;
  }, [deadline]);
  useEffect(() => {
    secondsLeftRef.current = secondsLeft;
  }, [secondsLeft]);

  // Persist the durations.
  useEffect(() => {
    localStorage.setItem(DURATIONS_KEY, JSON.stringify(durations));
  }, [durations]);

  // Persist the live timer snapshot so navigation / refresh can resume it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const snapshot: TimerSnapshot = { mode, secondsLeft, running, deadline };
    try {
      localStorage.setItem(TIMER_KEY, JSON.stringify(snapshot));
    } catch {
      // storage unavailable
    }
  }, [mode, secondsLeft, running, deadline]);

  // Complete a finished session: chime, notify, and advance to the next mode.
  const finish = useCallback(
    (finishedMode: Mode) => {
      beep();
      if (finishedMode === "focus") {
        notify("Focus complete 🎉", "Great job! Time for a break.");
      } else {
        notify("Break over", "Back to focus — you've got this.");
      }

      if (finishedMode === "focus") {
        const sum = countRef.current + 1;
        countRef.current = sum;
        setCompletedFocus(sum);
        const nextMode: Mode = sum % 4 === 0 ? "long" : "short";
        setMode(nextMode);
        setSecondsLeft(durations[nextMode] * 60);
      } else {
        setMode("focus");
        setSecondsLeft(durations.focus * 60);
      }
      setRunning(false);
      setDeadline(null);
    },
    [durations],
  );

  // Drive the countdown off the wall-clock deadline. The effect re-runs when
  // mode/durations change so closures stay fresh.
  useEffect(() => {
    if (!running || deadline == null) return;
    const tick = () => {
      if (deadlineRef.current == null) return;
      const remaining = Math.ceil((deadlineRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        finish(mode);
      } else {
        setSecondsLeft(remaining);
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [running, deadline, mode, finish]);

  // Recompute the moment the tab becomes visible again (timers get throttled
  // in background tabs) so the displayed time never drifts.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (!runningRef.current || deadlineRef.current == null) return;
      const remaining = Math.ceil((deadlineRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        finish(mode);
      } else {
        setSecondsLeft(remaining);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [finish, mode]);

  // While running, reflect the remaining time in the tab title.
  useEffect(() => {
    if (running) {
      document.title = `${formatClock(secondsLeft)} ${mode} · Apex01`;
    } else {
      document.title = "Pomodoro — Apex01";
    }
    return () => {
      document.title = "Pomodoro — Apex01";
    };
  }, [running, secondsLeft, mode]);

  // If a session ended while the component was unmounted (user navigated to
  // another section), finish it now so counts and notifications stay accurate.
  useEffect(() => {
    const t = readTimer();
    if (t?.running && t.deadline != null && t.deadline <= Date.now()) {
      finish(t.mode);
    }
  }, [finish]);

  function selectMode(next: Mode) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
    setDeadline(null);
    setMode(next);
    setSecondsLeft(durations[next] * 60);
  }

  function reset() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
    setDeadline(null);
    setSecondsLeft(durations[mode] * 60);
  }

  function ensureNotificationPermission() {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().then((p) => setNotifState(p)).catch(() => {});
    }
  }

  function start() {
    ensureNotificationPermission();
    if (runningRef.current) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setRunning(false);
      setDeadline(null);
      return;
    }
    setRunning(true);
    setDeadline(Date.now() + secondsLeftRef.current * 1000);
  }

  function nudge(delta: number) {
    if (running) return;
    setSecondsLeft((s) => Math.min(Math.max(s + delta * 60, 60), 180 * 60));
  }

  function changeDuration(target: Mode, minutes: number) {
    const next = { ...durations, [target]: clamp(minutes) };
    setDurations(next);
    if (target === mode && !running) {
      setSecondsLeft(next[target] * 60);
    }
  }

  const cfg = MODES[mode];
  const total = durations[mode] * 60;
  const clamped = total > 0 ? Math.min(Math.max(1 - secondsLeft / total, 0), 1) : 0;
  const R = 128;
  const C = 2 * Math.PI * R;
  const Icon = cfg.icon;
  const notifBlocked = notifState === "denied" || notifState === "unsupported";

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex gap-2 rounded-full border border-line bg-surface p-1.5">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => selectMode(m)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              mode === m
                ? "bg-apex-gradient text-white shadow-lg shadow-apex/20"
                : "text-muted hover:text-foreground"
            }`}
          >
            {MODES[m].label}
          </button>
        ))}
      </div>

      <div className="relative flex items-center justify-center">
        <svg
          width="340"
          height="340"
          viewBox="0 0 340 340"
          className="drop-shadow-[0_0_35px_rgba(255,122,26,0.12)]"
        >
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={cfg.gradFrom} />
              <stop offset="100%" stopColor={cfg.gradTo} />
            </linearGradient>
          </defs>
          <circle cx="170" cy="170" r={R} fill="none" stroke="#1c1c26" strokeWidth="14" />
          <circle
            cx="170"
            cy="170"
            r={R + 26}
            fill="none"
            stroke="#23232f"
            strokeWidth="1.5"
            strokeDasharray="1.5 9"
          />
          <circle
            cx="170"
            cy="170"
            r={R}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - clamped)}
            transform="rotate(-90 170 170)"
            className="transition-[stroke-dashoffset] duration-700 ease-linear"
          />
          <circle
            cx="170"
            cy="170"
            r={R}
            fill="none"
            stroke="url(#ringGrad)"
            strokeOpacity="0.35"
            strokeWidth="30"
            strokeLinecap="round"
            strokeDasharray={`3 ${C - 3}`}
            strokeDashoffset={-C * clamped}
            style={{ filter: "blur(6px)" }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-muted">{cfg.label}</p>
          <p
            className="font-mono font-bold tabular-nums"
            style={{
              color: cfg.color,
              fontSize: secondsLeft >= 5400 ? "3rem" : "3.75rem",
            }}
          >
            {formatClock(secondsLeft)}
          </p>
          <div className="mt-1 flex items-center gap-3 text-muted">
            <button
              onClick={() => nudge(-1)}
              className="rounded-full border border-line p-1.5 transition hover:border-apex/50 hover:text-apex"
              aria-label="Minus one minute"
            >
              <Minus size={14} />
            </button>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
              <Icon size={18} style={{ color: cfg.color }} />
              {completedFocus} session{completedFocus === 1 ? "" : "s"} today
            </span>
            <button
              onClick={() => nudge(1)}
              className="rounded-full border border-line p-1.5 transition hover:border-apex/50 hover:text-apex"
              aria-label="Plus one minute"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={reset} aria-label="Reset timer" className="btn-ghost">
          <RotateCcw size={18} />
        </Button>
        <Button onClick={start} className="btn-primary h-14 w-32 rounded-full text-base">
          {running ? (
            <>
              <Pause size={20} /> Pause
            </>
          ) : (
            <>
              <Play size={20} /> Start
            </>
          )}
        </Button>
        <Button
          onClick={() => setSettingsOpen((o) => !o)}
          aria-label="Timer settings"
          className="btn-ghost"
        >
          <Settings2 size={18} />
        </Button>
      </div>

      {notifBlocked && (
        <p className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <AlertTriangle size={14} />
          Browser notifications are {notifState === "denied" ? "blocked" : "unsupported"} — the
          chime and tab title still alert you.
        </p>
      )}

      {settingsOpen && (
        <div className="card w-full max-w-md p-5">
          <h3 className="text-sm font-semibold">Timer durations (minutes)</h3>
          <p className="mt-0.5 text-xs text-muted">
            Changes apply to the current mode when the timer is reset or stopped.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(MODE_ORDER as Mode[]).map((m) => (
              <div key={m}>
                <Label htmlFor={`dur-${m}`}>{MODES[m].label}</Label>
                <Input
                  id={`dur-${m}`}
                  type="number"
                  min={1}
                  max={180}
                  value={durations[m]}
                  onChange={(e) => changeDuration(m, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}