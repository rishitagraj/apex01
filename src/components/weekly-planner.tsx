"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/ui";

type Priority = "LOW" | "MEDIUM" | "HIGH";
type Todo = {
  id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  completed: boolean;
  dueDate: string | null;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PRIORITY_ORDER: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

const PRIORITY_DOT: Record<Priority, string> = {
  HIGH: "bg-rose-400",
  MEDIUM: "bg-apex",
  LOW: "bg-muted/50",
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function shiftWeeks(d: Date, weeks: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + weeks * 7);
  return x;
}

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateKeyOf(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    return iso.slice(0, 10);
  }
  return toKey(d);
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function WeeklyPlanner() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/todos")
      .then((r) => r.json())
      .then((data) => setTodos(data.todos ?? []))
      .catch(() => setError("Could not load your tasks."))
      .finally(() => setLoading(false));
  }, []);

  const todayKey = useMemo(() => toKey(new Date()), []);
  const weekStart = useMemo(() => shiftWeeks(mondayOf(new Date()), weekOffset), [weekOffset]);
  const weekStartKey = toKey(weekStart);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftWeeks(weekStart, i)), [weekStart]);

  const { byDay, overdue, unscheduled } = useMemo(() => {
    const sortTasks = (arr: Todo[]) =>
      [...arr].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.dueDate !== b.dueDate && a.dueDate && b.dueDate) {
          return dateKeyOf(a.dueDate)!.localeCompare(dateKeyOf(b.dueDate)!);
        }
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      });

    const byDay: Record<string, Todo[]> = {};
    const overdue: Todo[] = [];
    const unscheduled: Todo[] = [];
    const weekEndExclusive = toKey(shiftWeeks(weekStart, 7));

    for (const todo of todos) {
      const key = todo.dueDate ? dateKeyOf(todo.dueDate) : null;
      if (!key) {
        unscheduled.push(todo);
        continue;
      }
      if (key < weekStartKey) {
        if (!todo.completed) overdue.push(todo);
        continue;
      }
      if (key < weekEndExclusive) {
        (byDay[key] ||= []).push(todo);
      }
    }

    for (const k of Object.keys(byDay)) byDay[k] = sortTasks(byDay[k]);
    return { byDay, overdue: sortTasks(overdue), unscheduled: sortTasks(unscheduled) };
  }, [todos, weekStart, weekStartKey]);

  const weekTodos = useMemo(() => Object.values(byDay).flat(), [byDay]);
  const doneThisWeek = weekTodos.filter((t) => t.completed).length;

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

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted">Loading your week…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            aria-label="Previous week"
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-foreground"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="min-w-44 text-center text-sm font-semibold">
            {dayLabel(weekStart)} – {dayLabel(shiftWeeks(weekStart, 6))}
          </div>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            aria-label="Next week"
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-foreground"
          >
            <ChevronRight size={16} />
          </button>
          {weekOffset !== 0 ? (
            <Button onClick={() => setWeekOffset(0)} className="ml-1 text-xs">
              This week
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted">
          {doneThisWeek}/{weekTodos.length} done this week
        </p>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {todos.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title="No tasks yet"
          subtitle="Head to the Tasks tab to add tasks with due dates, then see them laid out across your week here."
        />
      ) : (
        <>
          {overdue.length > 0 ? (
            <Card className="border-rose-500/30 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-rose-400">
                Overdue
              </p>
              <ul className="space-y-2">
                {overdue.map((todo) => (
                  <OverdueRow key={todo.id} todo={todo} onToggle={() => toggle(todo)} />
                ))}
              </ul>
            </Card>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {days.map((day, i) => {
              const key = toKey(day);
              const dayTodos = byDay[key] ?? [];
              const isToday = key === todayKey;
              return (
                <Card
                  key={key}
                  className={`p-3 ${isToday ? "border-apex/50" : ""}`}
                >
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {WEEKDAYS[i]}
                    </span>
                    <span className={`text-xs ${isToday ? "font-semibold text-apex" : "text-muted"}`}>
                      {day.getDate()}
                    </span>
                  </div>
                  {dayTodos.length === 0 ? (
                    <p className="text-xs text-muted/60">Nothing planned</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {dayTodos.map((todo) => (
                        <li key={todo.id}>
                          <button
                            onClick={() => toggle(todo)}
                            className={`flex w-full items-start gap-1.5 rounded-lg p-1 text-left transition hover:bg-surface ${
                              todo.completed ? "opacity-50" : ""
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                                todo.completed
                                  ? "border-transparent bg-apex-gradient text-white"
                                  : "border-line"
                              }`}
                            >
                              {todo.completed ? <Check size={9} strokeWidth={3} /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block truncate text-xs font-medium ${
                                  todo.completed ? "line-through" : ""
                                }`}
                              >
                                {todo.title}
                              </span>
                            </span>
                            <span
                              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[todo.priority]}`}
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>

          {unscheduled.length > 0 ? (
            <Card className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                No due date ({unscheduled.length})
              </p>
              <ul className="space-y-2">
                {unscheduled.map((todo) => (
                  <OverdueRow key={todo.id} todo={todo} onToggle={() => toggle(todo)} />
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function OverdueRow({
  todo,
  onToggle,
}: {
  todo: Todo;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        onClick={onToggle}
        className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition hover:bg-surface ${
          todo.completed ? "opacity-50" : ""
        }`}
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
            todo.completed
              ? "border-transparent bg-apex-gradient text-white"
              : "border-line"
          }`}
        >
          {todo.completed ? <Check size={10} strokeWidth={3} /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-sm font-medium ${
              todo.completed ? "line-through" : ""
            }`}
          >
            {todo.title}
          </span>
        </span>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[todo.priority]}`} />
      </button>
    </li>
  );
}