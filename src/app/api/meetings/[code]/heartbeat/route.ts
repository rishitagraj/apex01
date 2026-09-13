import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'

const MAX_DELTA_MS = 5 * 60 * 1000 // cap a single heartbeat chunk at 5 min
const HEARTBEAT_INTERVAL_MS = 60 * 1000

export async function POST(request: Request, ctx: RouteContext<'/api/meetings/[code]/heartbeat'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await ctx.params

  const meeting = await db.meeting.findUnique({ where: { code } })
  if (!meeting) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const member = await db.meetingMember.findUnique({
    where: { meetingId_userId: { meetingId: meeting.id, userId } },
  })

  const now = new Date()
  let addedSeconds = 0

  if (member) {
    const prev = member.lastHeartbeatAt.getTime()
    const delta = now.getTime() - prev

    // Only count time if this looks like a healthy continuous heartbeat
    // (roughly every minute), and cap the chunk defensively.
    if (delta >= Math.round(HEARTBEAT_INTERVAL_MS * 0.5) && delta <= MAX_DELTA_MS) {
      addedSeconds = Math.round(delta / 1000)
    }
  }

  if (addedSeconds > 0) {
    await db.$transaction([
      db.meetingMember.update({
        where: { meetingId_userId: { meetingId: meeting.id, userId } },
        data: { minutes: { increment: Math.round(addedSeconds / 60) }, lastHeartbeatAt: now },
      }),
      db.user.update({
        where: { id: userId },
        data: { totalMinutes: { increment: Math.round(addedSeconds / 60) } },
      }),
      db.studyDay.upsert({
        where: { userId_date: { userId, date: now } },
        update: { minutes: { increment: Math.round(addedSeconds / 60) } },
        create: { userId, date: now, minutes: Math.round(addedSeconds / 60) },
      }),
    ])
  } else {
    // Re-anchor the presence timestamp even when nothing is credited, so a
    // returning user does not later accumulate a huge chunk.
    await db.meetingMember.upsert({
      where: { meetingId_userId: { meetingId: meeting.id, userId } },
      update: { lastHeartbeatAt: now },
      create: {
        meetingId: meeting.id,
        userId,
        minutes: 0,
        joinedAt: now,
        lastHeartbeatAt: now,
      },
    })
  }

  return NextResponse.json({ ok: true, addedSeconds })
}