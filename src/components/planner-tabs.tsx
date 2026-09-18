"use client";

import { useState } from "react";
import { CalendarDays, ListChecks, ClipboardList } from "lucide-react";
import { WeeklyPlanner } from "@/components/weekly-planner";
import { TodoList } from "@/components/todo-list";
import { TimetablePlanner } from "@/components/timetable-planner";
import { AssessmentsPlanner } from "@/components/assessments-planner";

const TABS = [
  { id: "week", label: "Week", icon: CalendarDays },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "assessments", label: "Assessments", icon: ClipboardList },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function PlannerTabs() {
  const [tab, setTab] = useState<TabId>("week");

  return (
    <div className="space-y-6">
      <div className="flex w-fit flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm capitalize transition ${
              tab === id ? "bg-apex-gradient text-white" : "text-muted hover:text-foreground"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "week" ? <WeeklyPlanner /> : null}
      {tab === "tasks" ? (
        <>
          <TodoList />
          <TimetablePlanner />
        </>
      ) : null}
      {tab === "assessments" ? <AssessmentsPlanner /> : null}
    </div>
  );
}