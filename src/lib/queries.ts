import { db } from '@/lib/db'

export type WeekPoint = { date: string; minutes: number }

export async function getDashboardStats(userId: string) {
  const now = new Date()
  const startOfWeek = new Date(now)
  const day = startOfWeek.getDay() || 7 // Monday = 1 ... Sunday = 7
  startOfWeek.setDate(startOfWeek.getDate() - day + 1)
  startOfWeek.setHours(0, 0, 0, 0)

  const [todayTodos, weekDays, user] = await Promise.all([
    db.todo.findMany({
      where: { userId },
      orderBy: [{ completed: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
    }),
    db.studyDay.findMany({
      where: { userId, date: { gte: startOfWeek } },
      orderBy: { date: 'asc' },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { totalMinutes: true, createdAt: true },
    }),
  ])

  const week: WeekPoint[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    const record = weekDays.find((w) => w.date.toISOString().slice(0, 10) === key)
    week.push({ date: key, minutes: record?.minutes ?? 0 })
  }

  return {
    totalMinutes: user?.totalMinutes ?? 0,
    memberSince: user?.createdAt ?? null,
    completedToday: todayTodos.filter((t) => t.completed).length,
    pendingToday: todayTodos.filter((t) => !t.completed).length,
    week,
  }
}

export async function getRoomList(userId: string) {
  const meetings = await db.meeting.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      host: { select: { name: true } },
      memberships: {
        select: { minutes: true, lastHeartbeatAt: true },
      },
    },
  })

  const now = Date.now()
  return meetings.map((m) => ({
    id: m.id,
    name: m.name,
    code: m.code,
    hostName: m.host.name,
    createdAt: m.createdAt,
    isHost: m.hostId === userId,
    participantCount: m.memberships.filter(
      (p) => now - p.lastHeartbeatAt.getTime() < 3 * 60_000,
    ).length,
    totalMinutes: m.memberships.reduce((sum, p) => sum + p.minutes, 0),
  }))
}

export async function getLeaderboard() {
  const users = await db.user.findMany({
    orderBy: { totalMinutes: 'desc' },
    take: 100,
    select: { id: true, name: true, totalMinutes: true },
  })
  return users.map((u, i) => ({ rank: i + 1, ...u }))
}