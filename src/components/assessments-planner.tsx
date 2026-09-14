"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ClipboardList, Weight } from "lucide-react";
import { Button, Input, Label, Badge, Card, EmptyState } from "@/components/ui";

type AssessmentType = "EXAM" | "QUIZ" | "ASSIGNMENT" | "PROJECT" | "OTHER";
type AssessmentStatus = "PLANNED" | "STUDYING" | "READY" | "DONE";

type Assessment = {
  id: string;
  subject: string;
  title: string;
  type: AssessmentType;
  dueDate: string | null;
  weight: number | null;
  status: AssessmentStatus;
  notes: string | null;
};

const TYPE_META: Record<AssessmentType, { label: string; color: "neutral" | "apex" | "danger" }> = {
  EXAM: { label: "Exam", color: "danger" },
  QUIZ: { label: "Quiz", color: "apex" },
  ASSIGNMENT: { label: "Assignment", color: "neutral" },
  PROJECT: { label: "Project", color: "apex" },
  OTHER: { label: "Other", color: "neutral" },
};

const STATUS_META: Record<AssessmentStatus, { label: string; color: "neutral" | "apex" | "success" }> = {
  PLANNED: { label: "Planned", color: "neutral" },
  STUDYING: { label: "Studying", color: "apex" },
  READY: { label: "Ready", color: "success" },
  DONE: { label: "Done", color: "success" },
};

const STATUS_ORDER: AssessmentStatus[] = ["PLANNED", "STUDYING", "READY", "DONE"];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysUntil(dueIso: string): number {
  const due = new Date(dueIso);
  if (Number.isNaN(due.getTime())) return 0;
  return Math.round((due.getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
}

function DueChip({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return <Badge color="neutral">No date</Badge>;
  const diff = daysUntil(dueDate);
  if (diff < 0) return <Badge color="danger">Overdue {Math.abs(diff)}d</Badge>;
  if (diff === 0) return <Badge color="danger">Due today</Badge>;
  if (diff <= 3) return <Badge color="apex">In {diff}d</Badge>;
  return <Badge color="neutral">In {diff}d</Badge>;
}

export function AssessmentsPlanner() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AssessmentType>("EXAM");
  const [dueDate, setDueDate] = useState("");
  const [weight, setWeight] = useState("");
  const [status, setStatus] = useState<AssessmentStatus>("PLANNED");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/api/assessments")
      .then((r) => r.json())
      .then((data) => setAssessments(data.assessments ?? []))
      .catch(() => setError("Could not load your assessments."))
      .finally(() => setLoading(false));
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!subject.trim() || !title.trim()) return;
    setSaving(true);
    try {
      const weightValue = weight.trim() === "" ? null : Number(weight);
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          title: title.trim(),
          type,
          dueDate: dueDate || null,
          weight: weightValue,
          status,
          notes: notes.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAssessments((prev) => [...prev, data.assessment]);
        setSubject("");
        setTitle("");
        setType("EXAM");
        setDueDate("");
        setWeight("");
        setStatus("PLANNED");
        setNotes("");
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.error ? `Could not add assessment: ${JSON.stringify(body.error)}` : "Could not add the assessment.");
      }
    } catch {
      setError("Could not add the assessment.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(assessment: Assessment, next: AssessmentStatus) {
    if (next === assessment.status) return;
    setAssessments((prev) =>
      prev.map((a) => (a.id === assessment.id ? { ...a, status: next } : a)),
    );
    await fetch(`/api/assessments/${assessment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  }

  async function remove(id: string) {
    setAssessments((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/assessments/${id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="ass-subject">Subject</Label>
              <Input
                id="ass-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Organic Chemistry"
              />
            </div>
            <div>
              <Label htmlFor="ass-title">Assessment</Label>
              <Input
                id="ass-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Final exam, Chapter 5 quiz"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="ass-type">Type</Label>
              <select
                id="ass-type"
                value={type}
                onChange={(e) => setType(e.target.value as AssessmentType)}
                className="input"
              >
                {(["EXAM", "QUIZ", "ASSIGNMENT", "PROJECT", "OTHER"] as const).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="ass-due">Due date</Label>
              <Input
                id="ass-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ass-weight">Weight (pts, optional)</Label>
              <Input
                id="ass-weight"
                type="number"
                min={0}
                max={500}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 40"
              />
            </div>
            <div>
              <Label htmlFor="ass-status">Status</Label>
              <select
                id="ass-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as AssessmentStatus)}
                className="input"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="ass-notes">Notes (optional)</Label>
            <Input
              id="ass-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Topics, marks breakdown, prep strategy…"
            />
          </div>

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          <Button type="submit" className="btn-primary" disabled={saving}>
            <Plus size={16} /> {saving ? "Adding…" : "Add assessment"}
          </Button>
        </form>
      </Card>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Loading assessments…</p>
      ) : assessments.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title="No assessments yet"
          subtitle="Track exams, quizzes, assignments and projects with their deadlines so nothing sneaks up on you."
        />
      ) : (
        <ul className="space-y-2.5">
          {assessments.map((assessment) => (
            <li key={assessment.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={TYPE_META[assessment.type].color}>
                      {TYPE_META[assessment.type].label}
                    </Badge>
                    <p className="text-sm font-semibold">{assessment.subject}</p>
                    <span className="text-sm text-muted">·</span>
                    <p className="text-sm text-muted">{assessment.title}</p>
                  </div>
                  {assessment.notes ? (
                    <p className="mt-1 text-xs text-muted">{assessment.notes}</p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <DueChip dueDate={assessment.dueDate} />
                    {assessment.weight != null ? (
                      <Badge color="neutral">
                        <Weight size={11} /> {assessment.weight} pts
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={assessment.status}
                    onChange={(e) => changeStatus(assessment, e.target.value as AssessmentStatus)}
                    aria-label="Update status"
                    className="input min-w-32"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_META[s].label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => remove(assessment.id)}
                    aria-label="Delete assessment"
                    className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}