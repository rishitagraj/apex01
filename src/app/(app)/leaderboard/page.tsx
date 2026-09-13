import type { Metadata } from "next";
import { LeaderboardClient } from "@/components/leaderboard-client";

export const metadata: Metadata = { title: "Leaderboard" };

export default function LeaderboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted">
          Ranked by total hours spent in focus rooms. Every minute pushed you higher.
        </p>
      </header>
      <LeaderboardClient />
    </div>
  );
}