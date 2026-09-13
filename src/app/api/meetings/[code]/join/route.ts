import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'

export async function POST(request: Request, ctx: RouteContext<'/api/meetings/[code]/join'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await ctx.params

  const meeting = await db.meeting.findUnique({ where: { code } })
  if (!meeting) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  await db.meetingMember.upsert({
    where: { meetingId_userId: { meetingId: meeting.id, userId } },
    update: { lastHeartbeatAt: new Date() },
    create: {
      meetingId: meeting.id,
      userId,
      minutes: 0,
      joinedAt: new Date(),
      lastHeartbeatAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true })
}