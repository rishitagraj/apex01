"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Check, CalendarClock, AlignLeft, PenLine, X } from "lucide-react";
import { Button, Input, Label, Badge, Card, EmptyState } from "@/components/ui";
import { ScribblePad } from "@/components/scribble-pad";

type Priority = "LOW" | "MEDIUM" | "HIGH";
type Todo = {
  id: string;
  title: string;
  notes: string | null;
  scribble: string | null;
  priority: Priority;
  completed: boolean;
  dueDate: string | null;
};

const PRIORITY_META: Record<Priority, { label: string; color: "neutral" | "apex" | "danger" }> = {
  LOW: { label: "Low", color: "neutral" },
  MEDIUM: { label: "Medium", color: "apex" },
  HIGH: { label: "High", color: "danger" },
};

const PRIORITY_ORDER: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [scribble, setScribble] = useState<string | null>(null);
  const [showPad, setShowPad] = useState(false);
  const [viewingScribble, setViewingScribble] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/todos")
      .then((r) => r.json())
      .then((data) => setTodos(data.todos ?? []))
      .catch(() => setError("Could not load your tasks."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!viewingScribble) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewingScribble(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewingScribble]);

  const handleScribble = useCallback((image: string | null) => setScribble(image), []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!title.trim() && !scribble) return;
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim() || "Scribble note",
        notes: notes.trim(),
        scribble,
        priority,
        dueDate: dueDate || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setTodos((prev) => [data.todo, ...prev]);
      setTitle("");
      setNotes("");
      setDueDate("");
      setScribble(null);
      setShowPad(false);
    } else {
      setError("Could not add the task.");
    }
  }

  async function toggle(todo: Todo) {
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, completed: !t.completed } : t)),
    );
    await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !todo.completed }),
    });
  }

  async function remove(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
  }

  const visible = useMemo(() => {
    const sorted = [...todos].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });
    if (filter === "active") return sorted.filter((t) => !t.completed);
    if (filter === "done") return sorted.filter((t) => t.completed);
    return sorted;
  }, [todos, filter]);

  const doneCount = todos.filter((t) => t.completed).length;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <form onSubmit={create} className="space-y-4">
          <div>
            <Label htmlFor="new-title">New task</Label>
            <Input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Revise integration by parts"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="new-notes">Notes (optional)</Label>
              <div className="relative">
                <Input
                  id="new-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Brief context…"
                />
                <AlignLeft size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            </div>
            <div>
              <Label htmlFor="new-priority">Priority</Label>
              <select
                id="new-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="input"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div>
              <Label htmlFor="new-due">Due date</Label>
              <Input
                id="new-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPad((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                scribble
                  ? "border-apex/40 bg-apex/10 text-apex"
                  : "border-line text-muted hover:text-foreground"
              }`}
            >
              <PenLine size={14} />
              {scribble ? "Edit scribble" : showPad ? "Hide scribble pad" : "Add a scribble (iPad / pen)"}
            </button>
            {scribble ? (
              <button
                type="button"
                onClick={() => {
                  setScribble(null);
                  setShowPad(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-400 transition hover:bg-rose-500/10"
              >
                <Trash2 size={14} /> Remove scribble
              </button>
            ) : null}
          </div>

          {showPad ? (
            <div>
              <p className="mb-2 text-xs text-muted">
                Draw with your finger, an Apple Pencil, or a pen tablet — the sketch gets attached to this task.
              </p>
              <ScribblePad onChange={handleScribble} />
            </div>
          ) : null}

          {!showPad && scribble ? (
            <img
              src={scribble}
              alt="Scribble preview"
              className="max-h-28 rounded-lg border border-line bg-white object-contain"
            />
          ) : null}

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          <Button type="submit" className="btn-primary">
            <Plus size={16} /> Add task
          </Button>
        </form>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 rounded-full border border-line bg-surface p-1">
          {(["all", "active", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-sm capitalize transition ${
                filter === f ? "bg-apex-gradient text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">
          {doneCount}/{todos.length} completed
        </p>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted">Loading tasks…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title={filter === "done" ? "Nothing finished yet" : "No tasks here"}
          subtitle="Add your first task above and start building momentum."
        />
      ) : (
        <ul className="space-y-2.5">
          {visible.map((todo) => (
            <li key={todo.id}>
              <Card
                className={`flex items-start gap-3 p-4 transition ${
                  todo.completed ? "opacity-60" : ""
                }`}
              >
                <button
                  onClick={() => toggle(todo)}
                  aria-label={todo.completed ? "Mark as not done" : "Mark as done"}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                    todo.completed
                      ? "border-transparent bg-apex-gradient text-white"
                      : "border-line hover:border-apex/60"
                  }`}
                >
                  {todo.completed ? <Check size={12} strokeWidth={3} /> : null}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`text-sm font-medium ${
                        todo.completed ? "line-through text-muted" : ""
                      }`}
                    >
                      {todo.title}
                    </p>
                    <Badge color={PRIORITY_META[todo.priority].color}>
                      {PRIORITY_META[todo.priority].label}
                    </Badge>
                    {todo.dueDate ? (
                      <Badge color="neutral">
                        <CalendarClock size={12} /> {new Date(todo.dueDate).toLocaleDateString()}
                      </Badge>
                    ) : null}
                  </div>
                  {todo.notes ? <p className="mt-1 text-xs text-muted">{todo.notes}</p> : null}
                  {todo.scribble ? (
                    <button
                      type="button"
                      onClick={() => setViewingScribble(todo.scribble)}
                      className="mt-2 block w-full overflow-hidden rounded-lg border border-line transition hover:border-apex/40"
                    >
                      <img
                        src={todo.scribble}
                        alt="Task scribble"
                        className="max-h-36 w-full bg-white object-contain"
                      />
                    </button>
                  ) : null}
                </div>

                <button
                  onClick={() => remove(todo.id)}
                  aria-label="Delete task"
                  className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-rose-500/10 hover:text-rose-400"
                >
                  <Trash2 size={16} />
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {viewingScribble ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setViewingScribble(null)}
        >
          <button
            type="button"
            onClick={() => setViewingScribble(null)}
            aria-label="Close scribble"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <X size={18} />
          </button>
          <img
            src={viewingScribble}
            alt="Scribble"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-full rounded-2xl bg-white shadow-2xl"
          />
        </div>
      ) : null}
    </div>
  );
}