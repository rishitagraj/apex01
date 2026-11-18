import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'

/**
 * Presence ping for a focus room. Rooms only track presence (who is live) —
 * they never credit focus time. Focus time comes solely from completed
 * Pomodoro sessions (see /api/pomodoro/sessions).
 */
export async function POST(request: Request, ctx: RouteContext<'/api/meetings/[code]/heartbeat'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await ctx.params

  const meeting = await db.meeting.findUnique({ where: { code } })
  if (!meeting) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const now = new Date()

  await db.meetingMember.upsert({
    where: { meetingId_userId: { meetingId: meeting.id, userId } },
    update: { lastHeartbeatAt: now },
    create: {
      meetingId: meeting.id,
      userId,
      joinedAt: now,
      lastHeartbeatAt: now,
    },
  })

  return NextResponse.json({ ok: true })
}
