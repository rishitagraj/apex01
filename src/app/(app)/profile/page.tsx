import type { Metadata } from "next";
import { Mail, CalendarDays, Timer, Trophy } from "lucide-react";
import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDashboardStats, getLeaderboard } from "@/lib/queries";
import { Card, formatMinutes } from "@/components/ui";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const userId = (await verifySession())!;
  const user = await db.user.findUnique({ where: { id: userId } });
  const stats = await getDashboardStats(userId);
  const rank = (await getLeaderboard()).find((e) => e.id === userId)?.rank ?? null;

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted">Your Apex01 stats at a glance.</p>
      </header>

      <Card className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-apex-gradient text-3xl font-bold text-white shadow-lg shadow-apex/30">
          {user?.name?.charAt(0).toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold">{user?.name}</h2>
          <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
            <span className="chip">
              <Mail size={12} /> {user?.email}
            </span>
            <span className="chip">
              <CalendarDays size={12} /> Joined {memberSince}
            </span>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-gradient">
              {formatMinutes(stats.totalMinutes)}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wider text-muted">Focus time</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gradient">
              {rank ? `#${rank}` : "—"}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wider text-muted">Rank</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniStat
          icon={<Timer size={16} />}
          label="This week"
          value={formatMinutes(stats.week.reduce((s, d) => s + d.minutes, 0))}
        />
        <MiniStat
          icon={<Trophy size={16} />}
          label="Tasks completed today"
          value={String(stats.completedToday)}
        />
        <MiniStat
          icon={<CalendarDays size={16} />}
          label="Active days this week"
          value={String(stats.week.filter((d) => d.minutes > 0).length)}
        />
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon} {label}
      </div>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </Card>
  );
}