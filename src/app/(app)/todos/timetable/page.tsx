import type { Metadata } from "next";
import { TimetablePlanner } from "@/components/timetable-planner";

export const metadata: Metadata = { title: "Timetable" };

export default function TimetablePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Timetable</h1>
        <p className="mt-1 text-sm text-muted">
          Organize your days, subjects and time slots in one place.
        </p>
      </header>
      <TimetablePlanner />
    </div>
  );
}