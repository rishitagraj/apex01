import type { Metadata } from "next";
import Link from "next/link";
import {
  Timer,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Flame,
  Trophy,
  Video,
} from "lucide-react";
import { getDashboardStats, getRoomList, getLeaderboard } from "@/lib/queries";
import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, Badge, formatMinutes } from "@/components/ui";
import { WeeklyChart } from "@/components/weekly-chart";
import { Calculator } from "@/components/calculator";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = (await verifySession())!;
  const user = await db.user.findUnique({ where: { id: userId } });

  const [stats, rooms] = await Promise.all([
    getDashboardStats(userId),
    getRoomList(userId),
  ]);

  const rank = (await getLeaderboard()).find((e) => e.id === userId)?.rank ?? null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, <span className="text-gradient">{user?.name}</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Let&apos;s get today&apos;s sessions into the books.
        </p>
      </header>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <DashboardCard
          label="Focus time"
          value={formatMinutes(stats.totalMinutes)}
          icon={<Timer size={16} />}
          accent="text-apex"
        />
        <DashboardCard
          label="Completed today"
          value={String(stats.completedToday)}
          icon={<CheckCircle2 size={16} />}
          accent="text-emerald-400"
        />
        <DashboardCard
          label="Open tasks"
          value={String(stats.pendingToday)}
          icon={<CircleDashed size={16} />}
          accent="text-muted"
        />
        <DashboardCard
          label="Global rank"
          value={rank ? `#${rank}` : "—"}
          icon={<Trophy size={16} />}
          accent="text-amber-300"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Weekly chart */}
        <Card className="p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">This week&apos;s focus</h2>
            <Badge color="apex">
              <Flame size={12} /> study minutes
            </Badge>
          </div>
          <WeeklyChart initial={stats.week} />
        </Card>

        {/* Quick actions */}
        <Card className="flex flex-col justify-center gap-2 p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold">Jump back in</h2>
          <Link href="/pomodoro" className="btn btn-primary mt-2">
            <Timer size={16} /> Start a Pomodoro
          </Link>
          <Link href={rooms.length > 0 ? `/rooms/${rooms[0].code}` : "/rooms"} className="btn">
            <Video size={16} /> Open your focus room
          </Link>
          <Link href="/todos" className="btn btn-ghost">
            Review today&apos;s tasks <ArrowRight size={16} />
          </Link>
        </Card>
      </div>

      {/* Recent rooms */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your focus rooms</h2>
          <Link href="/rooms" className="flex items-center gap-1 text-sm font-medium text-apex hover:underline">
            Manage rooms <ArrowRight size={14} />
          </Link>
        </div>

        {rooms.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            No rooms yet.{" "}
            <Link href="/rooms" className="text-apex underline">
              Create your first focus room
            </Link>
            .
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.slice(0, 6).map((room) => (
              <li key={room.id}>
                <Link
                  href={`/rooms/${room.code}`}
                  className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 transition hover:border-apex/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{room.name}</p>
                    <p className="font-mono text-xs text-muted">{room.code}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-emerald-400">
                    {room.participantCount} live
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Calculator */}
      <div className="max-w-md">
        <Calculator defaultOpen={false} />
      </div>
    </div>
  );
}

function DashboardCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card className="p-4">
      <div className={`flex items-center gap-1.5 text-xs font-medium ${accent}`}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}