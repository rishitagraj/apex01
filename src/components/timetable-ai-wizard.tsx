"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Check,
  AlertTriangle,
  CalendarDays,
  Sun,
} from "lucide-react";
import { Button, Label } from "@/components/ui";
import {
  TIMETABLE_MODEL_IDS,
  TIMETABLE_MODEL_OPTIONS,
  WEEKDAYS,
} from "@/types/timetable";
import type { TimetableDraft, TimetableDayRow, TimetableModelChoice } from "@/types/timetable";

type Step = 1 | 2 | 3;

function errText(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    for (const value of Object.values(err as Record<string, unknown>)) {
      if (Array.isArray(value) && value.length > 0) return String(value[0]);
      if (typeof value === "string") return value;
    }
  }
  return null;
}

function TimeField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="time"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function StepDots({ step }: { step: Step }) {
  const labels = ["Your routine", "Priorities", "Preview & edit"];
  return (
    <div className="flex items-center gap-1.5">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <span
            key={label}
            className={`chip px-2 py-0.5 text-[11px] ${
              active
                ? "border-apex/40 bg-apex/10 text-apex"
                : done
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-line bg-surface text-muted"
            }`}
          >
            {done ? <Check size={11} className="mr-1 inline" /> : null}
            {label}
          </span>
        );
      })}
    </div>
  );
}

export function AiTimetableWizard({
  existingCount,
  onClose,
  onSaved,
}: {
  existingCount: number;
  onClose: () => void;
  onSaved: (days: TimetableDayRow[], mode: "append" | "replace") => void;
}) {
  const [step, setStep] = useState<Step>(1);

  // Step 1 — routine / questions
  const [wakeTime, setWakeTime] = useState("06:30");
  const [sleepTime, setSleepTime] = useState("22:30");
  const [schoolStart, setSchoolStart] = useState("08:00");
  const [schoolEnd, setSchoolEnd] = useState("14:00");
  const [homeTime, setHomeTime] = useState("15:00");
  const [dayNames, setDayNames] = useState<string[]>([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]);
  const [coaching, setCoaching] = useState("");
  const [description, setDescription] = useState("");

  // Step 2 — priorities
  const [studyHours, setStudyHours] = useState("4");
  const [model, setModel] = useState<TimetableModelChoice>("auto");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState("");
  const [extra, setExtra] = useState("");

  // Step 3 — preview
  const [draft, setDraft] = useState<TimetableDraft | null>(null);
  const [mode, setMode] = useState<"append" | "replace">(
    existingCount > 0 ? "replace" : "append",
  );
  const [engine, setEngine] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/syllabus/export?format=json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { subjects?: { name: string }[] } | null) => {
        if (cancelled || !data?.subjects) return;
        const names = [...new Set(data.subjects.map((s) => s.name))].filter(
          Boolean,
        );
        setSubjectOptions(names);
      })
      .catch(() => {
        /* syllabus is optional here */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleDay(name: string) {
    setDayNames((prev) =>
      prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name],
    );
  }

  function togglePriority(name: string) {
    setPriorities((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    );
  }

  function addCustom() {
    const v = customSubject.trim();
    if (!v) return;
    if (!priorities.includes(v)) setPriorities((prev) => [...prev, v]);
    setCustomSubject("");
  }

  const payload = useMemo(
    () => ({
      model,
      wakeTime,
      sleepTime,
      schoolStart,
      schoolEnd,
      homeTime,
      days: dayNames,
      coaching,
      studyHours: studyHours === "" ? null : Number(studyHours),
      priorities,
      description,
      extra,
    }),
    [
      model,
      wakeTime,
      sleepTime,
      schoolStart,
      schoolEnd,
      homeTime,
      dayNames,
      coaching,
      studyHours,
      priorities,
      description,
      extra,
    ],
  );

  async function generate() {
    if (step === 1 && !description.trim() && !homeTime && !schoolEnd) {
      setError("Tell the planner something about your day first.");
      return;
    }
    setStep(3);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/timetable/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          errText(data?.error) || `Could not generate a timetable (${res.status}).`,
        );
        setStep(2);
        return;
      }
      setDraft(data.draft as TimetableDraft);
      setEngine((data.engine as string) ?? null);
      setUsedModel((data.model as string) ?? null);
    } catch {
      setError("Network error while generating. Check your connection.");
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!draft || draft.days.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/timetable/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, days: draft.days }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errText(data?.error) || "Could not save the timetable.");
        return;
      }
      onSaved((data.days as TimetableDayRow[]) ?? [], mode);
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  function updateDayName(di: number, name: string) {
    setDraft((d) =>
      d ? { ...d, days: d.days.map((x, i) => (i === di ? { ...x, name } : x)) } : d,
    );
  }

  function deleteDay(di: number) {
    setDraft((d) => (d ? { ...d, days: d.days.filter((_, i) => i !== di) } : d));
  }

  function updateSlot(
    di: number,
    si: number,
    patch: Partial<TimetableDraft["days"][number]["slots"][number]>,
  ) {
    setDraft((d) =>
      d
        ? {
            ...d,
            days: d.days.map((day, i) =>
              i === di
                ? {
                    ...day,
                    slots: day.slots.map((s, j) =>
                      j === si ? { ...s, ...patch } : s,
                    ),
                  }
                : day,
            ),
          }
        : d,
    );
  }

  function deleteSlot(di: number, si: number) {
    setDraft((d) =>
      d
        ? {
            ...d,
            days: d.days.map((day, i) =>
              i === di
                ? { ...day, slots: day.slots.filter((_, j) => j !== si) }
                : day,
            ),
          }
        : d,
    );
  }

  function addSlot(di: number) {
    setDraft((d) =>
      d
        ? {
            ...d,
            days: d.days.map((day, i) =>
              i === di
                ? {
                    ...day,
                    slots: [
                      ...day.slots,
                      { subject: "", startAt: "16:00", endAt: "17:00", notes: "" },
                    ].sort((a, b) => a.startAt.localeCompare(b.startAt)),
                  }
                : day,
            ),
          }
        : d,
    );
  }

  const canSave = Boolean(draft && draft.days.some((d) => d.slots.length > 0));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-line bg-card sm:h-[88vh] sm:rounded-3xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-apex-gradient text-white">
                <Sparkles size={15} />
              </span>
              AI Timetable
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Answer a few questions and we&apos;ll build a timetable you can edit.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StepDots step={step} />
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                  <Sun size={15} className="text-amber-400" /> What does a normal day look like?
                </p>
                <p className="text-xs text-muted">
                  Pick your timings — or skip them and just describe your day below.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <TimeField id="w-wake" label="Wake up" value={wakeTime} onChange={setWakeTime} />
                <TimeField id="w-sleep" label="Sleep" value={sleepTime} onChange={setSleepTime} />
                <TimeField
                  id="w-school-start"
                  label="School starts"
                  value={schoolStart}
                  onChange={setSchoolStart}
                />
                <TimeField
                  id="w-school-end"
                  label="School ends"
                  value={schoolEnd}
                  onChange={setSchoolEnd}
                />
                <TimeField
                  id="w-home"
                  label="Reach home"
                  value={homeTime}
                  onChange={setHomeTime}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Which days should we plan?</p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const on = dayNames.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        aria-pressed={on}
                        className={`chip text-xs transition ${
                          on
                            ? "border-apex/40 bg-apex/10 text-apex"
                            : "border-line bg-surface text-muted hover:text-foreground"
                        }`}
                      >
                        {d.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label htmlFor="w-coaching">
                  Coaching / tuition / fixed commitments (optional)
                </Label>
                <input
                  id="w-coaching"
                  className="input"
                  value={coaching}
                  onChange={(e) => setCoaching(e.target.value)}
                  placeholder="e.g. Physics tuition Mon/Wed/Fri 6–8 PM, football 5 PM"
                  maxLength={500}
                />
              </div>

              <div>
                <Label htmlFor="w-desc">
                  Describe your average day in your own words
                </Label>
                <textarea
                  id="w-desc"
                  className="input min-h-32 resize-y"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. I get home around 3 PM, usually waste an hour, then study. Dinner at 8, sleep by 11. Weekends I have coaching in the morning…"
                  maxLength={4000}
                />
                <p className="mt-1 text-[11px] text-muted">
                  The more you write, the more accurate the plan will be.
                </p>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                  <CalendarDays size={15} className="text-apex" /> What should it optimise for?
                </p>
                <p className="text-xs text-muted">
                  Tell the planner which subjects matter most right now.
                </p>
              </div>

              <div className="max-w-[220px]">
                <Label htmlFor="w-hours">Target study hours per day</Label>
                <input
                  id="w-hours"
                  type="number"
                  min={0}
                  max={16}
                  step={0.5}
                  className="input"
                  value={studyHours}
                  onChange={(e) => setStudyHours(e.target.value)}
                  placeholder="e.g. 4"
                />
              </div>

              <div className="max-w-full sm:max-w-sm">
                <Label htmlFor="w-model">AI model</Label>
                <select
                  id="w-model"
                  className="input"
                  value={model}
                  onChange={(e) => {
                    const v = e.target.value;
                    if ((TIMETABLE_MODEL_IDS as readonly string[]).includes(v)) {
                      setModel(v as TimetableModelChoice);
                    }
                  }}
                >
                  <option value="auto">
                    Auto — Gemini first, then Groq
                  </option>
                  <optgroup label="Gemini">
                    {TIMETABLE_MODEL_OPTIONS.filter((o) => o.engine === "gemini").map(
                      (o) => (
                        <option key={o.id} value={o.id}>
                          {o.label} — {o.hint}
                        </option>
                      ),
                    )}
                  </optgroup>
                  <optgroup label="Groq">
                    {TIMETABLE_MODEL_OPTIONS.filter((o) => o.engine === "groq").map(
                      (o) => (
                        <option key={o.id} value={o.id}>
                          {o.label} — {o.hint}
                        </option>
                      ),
                    )}
                  </optgroup>
                </select>
                <p className="mt-1 text-[11px] text-muted">
                  Pick the engine that generates your plan.
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Subjects / topics to prioritise</p>
                {subjectOptions.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {subjectOptions.map((s) => {
                      const on = priorities.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => togglePriority(s)}
                          aria-pressed={on}
                          className={`chip text-xs transition ${
                            on
                              ? "border-apex/40 bg-apex/10 text-apex"
                              : "border-line bg-surface text-muted hover:text-foreground"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mb-2 text-[11px] text-muted">
                    No subjects found in your syllabus — type your own below.
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustom();
                      }
                    }}
                    placeholder="Add a subject or topic, e.g. Organic Chemistry"
                    maxLength={80}
                  />
                  <Button type="button" onClick={addCustom} className="shrink-0">
                    <Plus size={15} />
                  </Button>
                </div>
                {priorities.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {priorities.map((p) => (
                      <span key={p} className="chip border-apex/40 bg-apex/10 text-xs text-apex">
                        {p}
                        <button
                          type="button"
                          onClick={() => togglePriority(p)}
                          className="ml-1.5 opacity-70 hover:opacity-100"
                          aria-label={`Remove ${p}`}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <Label htmlFor="w-extra">Anything else to keep in mind? (optional)</Label>
                <textarea
                  id="w-extra"
                  className="input min-h-20 resize-y"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="e.g. exam on the 20th, tired after school, no study after 10 PM…"
                  maxLength={1500}
                />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <Loader2 size={28} className="animate-spin text-apex" />
                  <p className="text-sm font-semibold">Building your timetable…</p>
                  <p className="max-w-sm text-xs text-muted">
                    Reading your routine and balancing your subjects across the week.
                  </p>
                </div>
              ) : draft ? (
                <>
                  <div className="rounded-xl border border-line bg-surface p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {draft.days.length} day
                        {draft.days.length === 1 ? "" : "s"} generated
                        {usedModel || engine ? (
                          <span className="ml-2 chip border-line bg-card px-1.5 py-0 text-[10px] text-muted">
                            {usedModel || engine}
                          </span>
                        ) : null}
                      </p>
                      <span className="text-[11px] text-muted">Edit anything below</span>
                    </div>
                    {draft.summary ? (
                      <p className="mt-1.5 text-xs text-muted">{draft.summary}</p>
                    ) : null}
                    {draft.assumptions.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {draft.assumptions.map((a, i) => (
                          <li key={i} className="flex gap-1.5 text-[11px] text-amber-300/90">
                            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    {draft.days.map((day, di) => (
                      <div key={di} className="rounded-2xl border border-line p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <input
                            className="input max-w-[220px] py-1.5 text-sm font-semibold"
                            value={day.name}
                            onChange={(e) => updateDayName(di, e.target.value)}
                            maxLength={60}
                            aria-label="Day name"
                          />
                          <button
                            type="button"
                            onClick={() => deleteDay(di)}
                            aria-label={`Delete ${day.name}`}
                            className="rounded-lg p-1.5 text-muted transition hover:bg-rose-500/10 hover:text-rose-400"
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => addSlot(di)}
                            className="chip ml-auto border-line bg-surface text-[11px] text-muted hover:text-foreground"
                          >
                            <Plus size={11} className="mr-1 inline" /> Slot
                          </button>
                        </div>

                        {day.slots.length === 0 ? (
                          <p className="py-3 text-center text-xs text-muted">
                            No slots — add one.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {day.slots.map((slot, si) => (
                              <div
                                key={si}
                                className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-xl border border-line bg-black/20 px-2.5 py-2 sm:grid-cols-[auto_1.4fr_auto_auto_1fr_auto]"
                              >
                                <input
                                  type="time"
                                  className="input w-[104px] py-1 text-xs"
                                  value={slot.startAt}
                                  onChange={(e) =>
                                    updateSlot(di, si, { startAt: e.target.value })
                                  }
                                  aria-label="Start time"
                                />
                                <input
                                  className="input min-w-0 py-1 text-sm"
                                  value={slot.subject}
                                  onChange={(e) =>
                                    updateSlot(di, si, { subject: e.target.value })
                                  }
                                  placeholder="What's happening?"
                                  maxLength={120}
                                  aria-label="Slot name"
                                />
                                <input
                                  type="time"
                                  className="input w-[104px] py-1 text-xs"
                                  value={slot.endAt}
                                  onChange={(e) =>
                                    updateSlot(di, si, { endAt: e.target.value })
                                  }
                                  aria-label="End time"
                                />
                                <input
                                  className="input hidden min-w-0 py-1 text-xs sm:block"
                                  value={slot.notes}
                                  onChange={(e) =>
                                    updateSlot(di, si, { notes: e.target.value })
                                  }
                                  placeholder="Notes"
                                  maxLength={1000}
                                  aria-label="Slot notes"
                                />
                                <button
                                  type="button"
                                  onClick={() => deleteSlot(di, si)}
                                  aria-label="Delete slot"
                                  className="justify-self-end rounded-lg p-1.5 text-muted transition hover:bg-rose-500/10 hover:text-rose-400"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-line px-5 py-3">
          {error ? (
            <p className="mb-2 flex items-start gap-1.5 text-xs text-rose-400">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {error}
            </p>
          ) : null}

          {step === 3 && draft && !loading ? (
            <div className="mb-3 rounded-xl border border-line bg-surface px-3 py-2">
              <p className="mb-1.5 text-xs font-semibold">Save into my timetable</p>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input
                    type="radio"
                    name="tt-mode"
                    checked={mode === "replace"}
                    onChange={() => setMode("replace")}
                    className="accent-[var(--apex)]"
                  />
                  Replace {existingCount > 0 ? `my ${existingCount} day(s)` : "everything"}
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input
                    type="radio"
                    name="tt-mode"
                    checked={mode === "append"}
                    onChange={() => setMode("append")}
                    className="accent-[var(--apex)]"
                  />
                  Add alongside what I have
                </label>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {step > 1 ? (
                <Button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep((s) => (s === 3 ? 2 : 1) as Step);
                  }}
                  disabled={loading || saving}
                >
                  <ChevronLeft size={15} className="mr-1 inline" /> Back
                </Button>
              ) : (
                <Button type="button" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step === 1 ? (
                <Button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep(2);
                  }}
                  className="btn bg-apex-gradient text-white"
                >
                  Continue <ChevronRight size={15} className="ml-1 inline" />
                </Button>
              ) : null}

              {step === 2 ? (
                <>
                  <Button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep(1);
                    }}
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void generate()}
                    disabled={loading}
                    className="btn bg-apex-gradient text-white"
                  >
                    {loading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Sparkles size={15} />
                    )}
                    Generate timetable
                  </Button>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <Button
                    type="button"
                    onClick={() => {
                      setError(null);
                      void generate();
                    }}
                    disabled={loading}
                  >
                    <RefreshCw size={15} className="mr-1 inline" /> Regenerate
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving || loading || !canSave}
                    className="btn bg-apex-gradient text-white"
                  >
                    {saving ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    Save timetable
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
