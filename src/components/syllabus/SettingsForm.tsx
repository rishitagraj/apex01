"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Check, Loader2, TriangleAlert, Trash2 } from "lucide-react";
import { EXAM_TAGS } from "@/types/syllabus";
import type { SyllabusSettings } from "@/types/syllabus";

export function SettingsForm({
  initial,
  subjectIds,
}: {
  initial: SyllabusSettings;
  subjectIds: string[];
}) {
  const router = useRouter();
  const [examTags, setExamTags] = useState<string[]>(initial.defaultExamTags);
  const [autoRevisionDays, setAutoRevisionDays] = useState(initial.autoRevisionDays);
  const [weeklyTargetHours, setWeeklyTargetHours] = useState(initial.weeklyTargetHours);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleTag = (tag: string) =>
    setExamTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 12),
    );

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/syllabus/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examTags, autoRevisionDays, weeklyTargetHours }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      for (const id of subjectIds) {
        const res = await fetch("/api/syllabus/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "subject", id }),
        });
        if (!res.ok) throw new Error("Clear failed");
      }
      router.refresh();
      router.push("/syllabus");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <section className="card rounded-3xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Default exam tags</h2>
        <p className="mb-4 text-xs text-muted">
          Applied to new subjects when no tag can be inferred from your PDF.
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAM_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              aria-pressed={examTags.includes(tag)}
              className={`chip text-xs transition ${
                examTags.includes(tag)
                  ? "border-apex/50 bg-apex/15 text-apex"
                  : "border-line bg-surface text-muted hover:text-foreground"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      <section className="card rounded-3xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Study rhythm</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-xs text-muted">
              Auto-schedule revision every
              <b className="tabular-nums text-apex">{autoRevisionDays} days</b>
            </span>
            <input
              type="range"
              min={1}
              max={60}
              value={autoRevisionDays}
              onChange={(e) => setAutoRevisionDays(Number(e.target.value))}
              className="w-full accent-[#ff7a1a]"
            />
            <span className="mt-1 block text-[11px] text-muted">Default: 7 days</span>
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-xs text-muted">
              Weekly study target
              <b className="tabular-nums text-apex">{weeklyTargetHours}h</b>
            </span>
            <input
              type="range"
              min={1}
              max={120}
              value={weeklyTargetHours}
              onChange={(e) => setWeeklyTargetHours(Number(e.target.value))}
              className="w-full accent-[#ff7a1a]"
            />
            <span className="mt-1 block text-[11px] text-muted">Default: 20h / week</span>
          </label>
        </div>
      </section>

      {error ? (
        <p className="flex items-center gap-2 text-sm text-rose-300">
          <TriangleAlert size={15} /> {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button onClick={saveSettings} disabled={saving} className="btn bg-apex-gradient px-5 text-white shadow-lg shadow-apex/25 hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="mr-1.5 inline animate-spin" /> : <Save size={15} className="mr-1.5 inline" />}
          Save settings
        </button>
        {saved ? (
          <span className="flex items-center gap-1.5 text-sm text-emerald-400">
            <Check size={15} /> Saved
          </span>
        ) : null}
      </div>

      <section className="rounded-3xl border border-rose-500/25 bg-rose-500/5 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-300">
          <TriangleAlert size={15} /> Danger zone
        </h2>
        <p className="mt-1 mb-4 text-xs text-muted">
          Delete every subject, chapter and concept in your syllabus (import history is kept). This cannot be undone.
        </p>
        <button onClick={clearAll} disabled={deleting} className="btn border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">
          {deleting ? <Loader2 size={15} className="mr-1.5 inline animate-spin" /> : <Trash2 size={15} className="mr-1.5 inline" />}
          Delete entire syllabus
        </button>
      </section>
    </div>
  );
}