"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Plus,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  BookOpen,
  Printer,
  Sparkles,
} from "lucide-react";
import { Button, Input, Label, Card, EmptyState, Badge } from "@/components/ui";
import { BrandMark } from "@/components/brand";
import { exportPrint } from "@/lib/print";
import { AiTimetableWizard } from "@/components/timetable-ai-wizard";
import type { TimetableDayRow } from "@/types/timetable";

type Slot = {
  id: string;
  subject: string;
  startAt: string;
  endAt: string;
  notes: string | null;
  sortOrder: number;
};

type Day = {
  id: string;
  name: string;
  sortOrder: number;
  slots: Slot[];
};

function formatTime24(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (h < 12) return `${h || 12}:${String(m).padStart(2, "0")} AM`;
  return `${h === 12 ? 12 : h - 12}:${String(m).padStart(2, "0")} PM`;
}

function formatSlotTime(start: string, end: string): string {
  return `${formatTime24(start)} – ${formatTime24(end)}`;
}

export function TimetablePlanner() {
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dayName, setDayName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [subject, setSubject] = useState("");
  const [startAt, setStartAt] = useState("09:00");
  const [endAt, setEndAt] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [slotError, setSlotError] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [printSelection, setPrintSelection] = useState<"all" | string[]>("all");
  const printMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    fetch("/api/timetable")
      .then((r) => r.json())
      .then((data) => {
        const loaded = (data.days ?? []) as Day[];
        setDays(loaded);
        setActiveId((prev) => prev ?? loaded[0]?.id ?? null);
      })
      .catch(() => setError("Could not load your timetable."))
      .finally(() => setLoading(false));
  }, []);

  const active = days.find((d) => d.id === activeId) ?? null;

  function handleAiSaved(saved: TimetableDayRow[], mode: "append" | "replace") {
    if (mode === "replace" || days.length === 0) {
      setDays(saved);
      setActiveId(saved[0]?.id ?? null);
      if (mode === "replace") setPrintSelection("all");
    } else {
      setDays((prev) => [...prev, ...saved]);
      setActiveId(saved[0]?.id ?? null);
    }
    setError("");
    setAiOpen(false);
  }

  async function createDay(e: React.FormEvent) {
    e.preventDefault();
    if (!dayName.trim()) return;
    const res = await fetch("/api/timetable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: dayName.trim() }),
    });
    if (res.ok) {
      const { day } = await res.json();
      setDays((prev) => [...prev, day]);
      setActiveId(day.id);
      setDayName("");
      setError("");
    } else {
      setError("Could not add day.");
    }
  }

  async function deleteDay(id: string) {
    setDays((prev) => prev.filter((d) => d.id !== id));
    setPrintSelection((prev) =>
      prev === "all" ? prev : prev.filter((x) => x !== id),
    );
    if (activeId === id) {
      const remaining = days.filter((d) => d.id !== id);
      setActiveId(remaining[0]?.id ?? null);
    }
    await fetch(`/api/timetable/${id}`, { method: "DELETE" });
  }

  async function moveDay(dir: -1 | 1) {
    if (!active) return;
    const idx = days.findIndex((d) => d.id === active.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= days.length) return;
    const swapped = [...days];
    [swapped[idx], swapped[swapIdx]] = [swapped[swapIdx], swapped[idx]];
    setDays(swapped);
    const orderPatch = swapped.map((d, i) =>
      fetch(`/api/timetable/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: i }),
      }),
    );
    await Promise.allSettled(orderPatch);
  }

  function startRename(day: Day) {
    setRenaming(day.id);
    setRenameValue(day.name);
  }

  async function saveRename(id: string) {
    const name = renameValue.trim();
    if (!name) { setRenaming(null); return; }
    setRenaming(null);
    setDays((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)));
    await fetch(`/api/timetable/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  function togglePrintDay(id: string) {
    setPrintSelection((prev) => {
      const current = prev === "all" ? days.map((d) => d.id) : prev;
      return current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
    });
  }

  function selectAllPrint() {
    setPrintSelection("all");
  }

  function printNow() {
    printMenuRef.current?.removeAttribute("open");
    exportPrint();
  }

  function printSingleDay(dayId: string) {
    flushSync(() => setPrintSelection([dayId]));
    exportPrint();
  }

  async function createSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setSlotError("");
    if (!subject.trim()) { setSlotError("Subject is required."); return; }
    if (endAt <= startAt) { setSlotError("End time must be after start time."); return; }

    const res = await fetch(`/api/timetable/${active.id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subject.trim(), startAt, endAt, notes: notes.trim() || undefined }),
    });
    if (res.ok) {
      const { slot } = await res.json();
      setDays((prev) =>
        prev.map((d) =>
          d.id === active.id
            ? { ...d, slots: [...d.slots, slot].sort((a, b) => a.startAt.localeCompare(b.startAt)) }
            : d
        )
      );
      setSubject("");
      setNotes("");
      setError("");
    } else {
      setSlotError("Could not add slot.");
    }
  }

  async function deleteSlot(dayId: string, slotId: string) {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId ? { ...d, slots: d.slots.filter((s) => s.id !== slotId) } : d
      )
    );
    await fetch(`/api/timetable/slots/${slotId}`, { method: "DELETE" });
  }

  const printDays =
    printSelection === "all"
      ? days
      : days.filter((d) => printSelection.includes(d.id));
  const printTimeframes = Array.from(
    new Set(
      printDays.flatMap((d) => d.slots.map((s) => `${s.startAt}|${s.endAt}`)),
    ),
  )
    .map((key) => key.split("|") as [string, string])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

  const allDaysSelected = days.length > 0 && printDays.length === days.length;
  const printLabel =
    days.length === 0 || allDaysSelected
      ? "All days"
      : printDays.length === 0
        ? "None"
        : printDays.length === 1
          ? printDays[0].name
          : `${printDays.length} days`;

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted">Loading timetable…</p>;
  }

  return (
    <div className="space-y-6">
      {/* Export / print + AI actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Build your week by hand below — or let the AI planner draft it for you.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => setAiOpen(true)}
            className="btn bg-apex-gradient text-white"
            title="Answer a few questions and get an editable timetable"
          >
            <Sparkles size={16} /> AI Timetable
          </Button>
          <div className="inline-flex items-center gap-2">
            <details ref={printMenuRef} className="relative">
              <summary
                className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs text-muted transition hover:border-apex/30 hover:text-foreground [&::-webkit-details-marker]:hidden"
                title="Choose which days to include when printing"
              >
                <Printer size={14} />
                <span className="hidden sm:inline">Print:</span>
                <span className="font-medium text-foreground">{printLabel}</span>
                <ChevronDown size={13} />
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-line bg-card p-2 shadow-xl">
                <div className="flex items-center justify-between px-1.5 pb-1.5">
                  <span className="text-xs font-medium text-muted">Days to print</span>
                  <button
                    type="button"
                    onClick={selectAllPrint}
                    className="text-xs font-semibold text-apex hover:underline"
                  >
                    Select all
                  </button>
                </div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto">
                  {days.length === 0 ? (
                    <p className="px-1.5 py-2 text-xs text-muted">No days yet.</p>
                  ) : (
                    days.map((day) => {
                      const checked = printDays.some((d) => d.id === day.id);
                      return (
                        <label
                          key={day.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm transition hover:bg-surface"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePrintDay(day.id)}
                            className="h-4 w-4 accent-[var(--apex)]"
                          />
                          <span className="min-w-0 flex-1 truncate">{day.name}</span>
                          <span className="text-xs text-muted/70">{day.slots.length}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </details>
            <Button
              type="button"
              onClick={printNow}
              disabled={printDays.length === 0}
              title="Opens your browser's print dialog — choose 'Save as PDF'"
            >
              <Printer size={16} /> Export / Print
            </Button>
          </div>
        </div>
      </div>

      {/* Add day row */}
      <Card className="p-5">
        <form onSubmit={createDay} className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <Label htmlFor="new-day-name">Timetable</Label>
            <p className="mb-2 text-xs text-muted">
              Add named days (Mon, Fri, Week 1 …) and fill in your time slots below.
            </p>
            <Input
              id="new-day-name"
              value={dayName}
              onChange={(e) => setDayName(e.target.value)}
              placeholder="e.g. Monday / Week A / Exam Day 1"
            />
          </div>
          <Button type="submit" className="btn-primary shrink-0">
            <Plus size={16} /> Add day
          </Button>
        </form>
      </Card>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {days.length === 0 ? (
        <EmptyState
          title="No timetable days yet"
          subtitle="Add your first day above and start organizing your study slots."
        />
      ) : (
        <>
          {/* Day chips + move arrows */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => moveDay(-1)}
              aria-label="Move day left"
              className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-foreground disabled:opacity-30"
              disabled={!active || days.findIndex((d) => d.id === active!.id) <= 0}
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
              {days.map((day) => {
                const isActive = day.id === activeId;
                return (
                  <div key={day.id} className="flex items-center gap-0.5">
                    <button
                      onClick={() => setActiveId(day.id)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? "border-apex/40 bg-apex/10 text-apex"
                          : "border-line bg-surface text-muted hover:border-apex/30"
                      }`}
                    >
                      {day.name}
                      <span className="text-muted/60">({day.slots.length})</span>
                    </button>
                    {isActive && (
                      <>
                        <button
                          onClick={() => startRename(day)}
                          aria-label="Rename day"
                          className="shrink-0 rounded p-1 text-muted transition hover:bg-surface hover:text-foreground"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => deleteDay(day.id)}
                          aria-label="Delete day"
                          className="shrink-0 rounded p-1 text-muted transition hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => moveDay(1)}
              aria-label="Move day right"
              className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-foreground disabled:opacity-30"
              disabled={!active || days.findIndex((d) => d.id === active!.id) >= days.length - 1}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Active day panel */}
          {active && (
            <Card className="p-5">
              {/* Rename bar */}
              {renaming === active.id ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); saveRename(active.id); }}
                  className="mb-4 flex items-center gap-2"
                >
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                    className="max-w-xs"
                  />
                  <Button type="submit" className="btn-primary text-xs">Save</Button>
                  <Button type="button" className="text-xs" onClick={() => setRenaming(null)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <div className="mb-4 flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{active.name}</h3>
                  <Badge color="neutral">
                    {active.slots.length} slot{active.slots.length !== 1 ? "s" : ""}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => printSingleDay(active.id)}
                    title="Print this day on its own"
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs text-muted transition hover:border-apex/30 hover:text-foreground"
                  >
                    <Printer size={13} /> Print this day
                  </button>
                </div>
              )}

              {/* Add slot form */}
              <form onSubmit={createSlot} className="mb-4 space-y-3 border-b border-line pb-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="slot-subject">Subject</Label>
                    <div className="relative">
                      <Input
                        id="slot-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. Mathematics, Chemistry Lab…"
                      />
                      <BookOpen size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="slot-start">Start</Label>
                    <div className="relative">
                      <Input id="slot-start" type="time" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="slot-end">End</Label>
                    <div className="relative">
                      <Input id="slot-end" type="time" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="slot-notes">Notes (optional)</Label>
                  <Input
                    id="slot-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Room, chapter, focus…"
                  />
                </div>

                {slotError && <p className="text-xs text-rose-400">{slotError}</p>}

                <Button type="submit" className="btn-primary">
                  <Plus size={16} /> Add slot
                </Button>
              </form>

              {/* Slot list */}
              {active.slots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Clock size={28} className="mb-2 text-muted/50" />
                  <p className="text-sm font-medium text-muted">No slots yet</p>
                  <p className="mt-1 text-xs text-muted/70">
                    Add your first slot above — it will appear here sorted by start time.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {active.slots.map((slot) => (
                    <li key={slot.id}>
                      <div className="group flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition hover:border-apex/30">
                        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-apex/10 px-2.5 py-1 text-xs font-semibold text-apex">
                          <Clock size={11} />
                          {formatSlotTime(slot.startAt, slot.endAt)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{slot.subject}</p>
                          {slot.notes ? <p className="mt-0.5 text-xs text-muted">{slot.notes}</p> : null}
                        </div>
                        <button
                          onClick={() => deleteSlot(active.id, slot.id)}
                          aria-label="Delete slot"
                          className="shrink-0 rounded-lg p-1.5 text-muted opacity-0 transition hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}

      {/* Print-only view: branded timetable table (use Print → Save as PDF) */}
      <div className="print-area hidden" aria-hidden="true">
        <div className="print-head">
          <div className="flex items-center gap-2.5">
            <BrandMark size={40} />
            <span className="text-2xl font-bold tracking-tight">Apex01</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">Study Timetable</p>
            <p>{printLabel}</p>
            <p>
              {new Date().toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        {days.length === 0 ? (
          <p className="mt-12 text-center text-sm font-medium">
            No timetable days yet.
          </p>
        ) : printDays.length === 0 ? (
          <p className="mt-12 text-center text-sm font-medium">
            No days selected to print.
          </p>
        ) : printTimeframes.length === 0 ? (
          <p className="mt-12 text-center text-sm font-medium">
            No time slots to print for the selected day{printDays.length > 1 ? "s" : ""}.
          </p>
        ) : (
          <table className="print-timetable">
            <thead>
              <tr>
                <th>Time</th>
                {printDays.map((day) => (
                  <th key={day.id}>{day.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printTimeframes.map(([start, end]) => (
                <tr key={`${start}|${end}`}>
                  <td className="print-time">
                    {formatTime24(start)} – {formatTime24(end)}
                  </td>
                  {printDays.map((day) => {
                    const slot =
                      day.slots.find(
                        (s) => s.startAt === start && s.endAt === end,
                      ) ?? null;
                    return (
                      <td key={day.id}>
                        {slot ? (
                          <>
                            <span className="print-subject">{slot.subject}</span>
                            {slot.notes ? (
                              <p className="print-notes">{slot.notes}</p>
                            ) : null}
                          </>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {aiOpen ? (
        <AiTimetableWizard
          existingCount={days.length}
          onClose={() => setAiOpen(false)}
          onSaved={handleAiSaved}
        />
      ) : null}
    </div>
  );
}