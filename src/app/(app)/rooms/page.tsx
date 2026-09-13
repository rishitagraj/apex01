import type { Metadata } from "next";
import { RoomsClient } from "@/components/rooms-client";

export const metadata: Metadata = { title: "Focus rooms" };

export default function RoomsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Focus rooms</h1>
        <p className="mt-1 text-sm text-muted">
          Study face-to-face in live video rooms. Every minute you spend here counts toward
          your leaderboard score.
        </p>
      </header>
      <RoomsClient />
    </div>
  );
}