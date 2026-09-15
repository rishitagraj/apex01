import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomsClient } from "@/components/rooms-client";
import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Focus rooms" };

export default async function RoomsPage() {
  const userId = await verifySession();
  if (!userId) notFound();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Focus rooms</h1>
        <p className="mt-1 text-sm text-muted">
          Study face-to-face in live video rooms. Every minute you spend here counts toward
          your leaderboard score. Up to 5 rooms can be active at once.
        </p>
      </header>
      <RoomsClient isAdmin={user?.isAdmin ?? false} />
    </div>
  );
}