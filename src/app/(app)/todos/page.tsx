import type { Metadata } from "next";
import { TodoList } from "@/components/todo-list";

export const metadata: Metadata = { title: "Planner" };

export default function TodosPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Planner</h1>
        <p className="mt-1 text-sm text-muted">
          Your tasks, priorities and deadlines in one clean list.
        </p>
      </header>
      <TodoList />
    </div>
  );
}