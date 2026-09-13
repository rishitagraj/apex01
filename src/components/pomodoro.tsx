"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Plus, Minus, Flame, Coffee } from "lucide-react";
import { Button } from "@/components/ui";

type Mode = "focus" | "short" | "long";

const MODES: Record<
  Mode,
  { label: string; icon: typeof Flame; color: string; gradFrom: string; gradTo: string }
> = {
  focus: { label: "Focus", icon: Flame, color: "#ff7a1a", gradFrom: "#ff7a1a", gradTo: "#ff3d6e" },
  short: { label: "Short break", icon: Coffee, color: "#22d3ee", gradFrom: "#22d3ee", gradTo: "#3b82f6" },
  long: { label: "Long break", icon: Coffee, color: "#a78bfa", gradFrom: "#a78bfa", gradTo: "#6366f1" },
};

const DEFAULTS: Record<Mode, number> = { focus: 25, short: 5, long: 15 };
const STORAGE_KEY = "apex01:pomodoros";

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

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function Pomodoro() {
  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(DEFAULTS.focus * 60);
  const [running, setRunning] = useState(false);
  const [completedFocus, setCompletedFocus] = useState(() => {
    if (typeof window === "undefined") return 0;
    const stored = Number(localStorage.getItem(STORAGE_KEY) || 0);
    return Number.isNaN(stored) ? 0 : stored;
  });
  const countRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    countRef.current = completedFocus;
  }, [completedFocus]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(completedFocus));
  }, [completedFocus]);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  function selectMode(next: Mode) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
    setMode(next);
    setSecondsLeft(DEFAULTS[next] * 60);
  }

  function reset() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
    setSecondsLeft(DEFAULTS[mode] * 60);
  }

  function start() {
    if (running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setRunning(false);
      return;
    }
    setRunning(true);
    const modeRef = mode;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setRunning(false);
          beep();
          if (modeRef === "focus") {
            const sum = countRef.current + 1;
            countRef.current = sum;
            setCompletedFocus(sum);
            const nextMode: Mode = sum % 4 === 0 ? "long" : "short";
            setMode(nextMode);
            return DEFAULTS[nextMode] * 60;
          }
          const next: Mode = "focus";
          setMode(next);
          return DEFAULTS[next] * 60;
        }
        return s - 1;
      });
    }, 1000);
  }

  function nudge(delta: number) {
    if (running) return;
    setSecondsLeft((s) => Math.min(Math.max(s + delta * 60, 60), 180 * 60));
  }

  const cfg = MODES[mode];
  const clamped = Math.min(Math.max(1 - secondsLeft / (DEFAULTS[mode] * 60), 0), 1);
  const R = 128;
  const C = 2 * Math.PI * R;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const Icon = cfg.icon;

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
          <p className="font-mono text-6xl font-bold tabular-nums" style={{ color: cfg.color }}>
            {pad(mins)}:{pad(secs)}
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
              <Icon size={18} style={{ color: cfg.color }} className="text-apex" />
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
        <div className="w-14 text-center text-xs text-muted">Pomodoro</div>
      </div>
    </div>
  );
}