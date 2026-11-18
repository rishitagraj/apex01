import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { pomodoroSessionSchema } from '@/lib/validation'

/**
 * Records focus time from a completed Pomodoro session. This is the only place
 * that credits global focus time (User.totalMinutes / StudyDay) — focus rooms
 * track presence, not focus minutes.
 */
export async function POST(request: Request) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = pomodoroSessionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { minutes } = parsed.data
  const now = new Date()

  const [user, day] = await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { totalMinutes: { increment: minutes } },
      select: { totalMinutes: true },
    }),
    db.studyDay.upsert({
      where: { userId_date: { userId, date: now } },
      update: { minutes: { increment: minutes } },
      create: { userId, date: now, minutes },
    }),
  ])

  return NextResponse.json({
    ok: true,
    totalMinutes: user.totalMinutes,
    todayMinutes: day.minutes,
  })
}
