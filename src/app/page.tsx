import { LandingPage } from "@/components/landing/landing-page";
import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = await verifySession();

  let stats = { users: 0, minutes: 0, rooms: 0, tasks: 0 };
  try {
    const [users, minutes, rooms, tasks] = await Promise.all([
      db.user.count(),
      db.user.aggregate({ _sum: { totalMinutes: true } }),
      db.meeting.count(),
      db.todo.count(),
    ]);
    stats = {
      users,
      minutes: minutes._sum.totalMinutes ?? 0,
      rooms,
      tasks,
    };
  } catch {
    // Landing must not break because of transient DB issues.
    stats = { users: 0, minutes: 0, rooms: 0, tasks: 0 };
  }

  return <LandingPage signedIn={Boolean(userId)} stats={stats} />;
}