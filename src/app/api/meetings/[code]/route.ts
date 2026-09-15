import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'

export async function GET(request: Request, ctx: RouteContext<'/api/meetings/[code]'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await ctx.params

  const meeting = await db.meeting.findUnique({
    where: { code },
    include: {
      host: { select: { id: true, name: true } },
      memberships: {
        include: { user: { select: { id: true, name: true, totalMinutes: true } } },
      },
    },
  })

  if (!meeting) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const now = Date.now()
  return NextResponse.json({
    room: {
      id: meeting.id,
      name: meeting.name,
      code: meeting.code,
      hostName: meeting.host.name,
      isHost: meeting.hostId === userId,
      isJoined: meeting.memberships.some((p) => p.userId === userId),
      createdAt: meeting.createdAt,
      participants: meeting.memberships.map((p) => ({
        id: p.user.id,
        name: p.user.name,
        minutes: p.minutes,
        totalMinutes: p.user.totalMinutes,
        active: now - p.lastHeartbeatAt.getTime() < 3 * 60_000,
      })),
    },
  })
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/meetings/[code]'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await ctx.params

  const meeting = await db.meeting.findUnique({ where: { code } })
  if (!meeting) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  if (meeting.hostId !== userId) {
    const caller = await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
    if (!caller?.isAdmin) {
      return NextResponse.json({ error: 'Only the host or an admin can delete this room' }, { status: 403 })
    }
  }

  await db.meeting.delete({ where: { id: meeting.id } })

  return NextResponse.json({ ok: true })
}