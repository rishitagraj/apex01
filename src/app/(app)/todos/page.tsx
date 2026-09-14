import type { Metadata } from "next";
import { PlannerTabs } from "@/components/planner-tabs";

export const metadata: Metadata = { title: "Planner" };

export default function TodosPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Planner</h1>
        <p className="mt-1 text-sm text-muted">
          Your weekly schedule, tasks and assessment deadlines in one place.
        </p>
      </header>
      <PlannerTabs />
    </div>
  );
}