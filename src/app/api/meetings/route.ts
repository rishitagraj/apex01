import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { meetingSchema } from '@/lib/validation'
import { makeRoomName } from '@/lib/meeting-code'

export const MAX_ACTIVE_MEETINGS = 5

export async function GET() {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meetings = await db.meeting.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      host: { select: { name: true } },
      memberships: {
        select: {
          userId: true,
          minutes: true,
          lastHeartbeatAt: true,
          user: { select: { name: true } },
        },
      },
    },
  })

  const now = Date.now()
  const rooms = meetings.map((m) => ({
    id: m.id,
    name: m.name,
    code: m.code,
    hostName: m.host.name,
    createdAt: m.createdAt,
    isHost: m.hostId === userId,
    isJoined: m.memberships.some((p) => p.userId === userId),
    participantCount: m.memberships.filter(
      (p) => now - p.lastHeartbeatAt.getTime() < 3 * 60_000,
    ).length,
    totalHours: Math.round(
      (m.memberships.reduce((sum, p) => sum + p.minutes, 0) / 60) * 10,
    ) / 10,
  }))

  return NextResponse.json({ rooms })
}

export async function POST(request: Request) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = meetingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const name = parsed.data.name

  const activeCount = await db.meeting.count()
  if (activeCount >= MAX_ACTIVE_MEETINGS) {
    return NextResponse.json(
      {
        error: `Only ${MAX_ACTIVE_MEETINGS} rooms can be active at once. Ask a host to end one, or contact an admin.`,
      },
      { status: 409 },
    )
  }

  let code = ''
  // Ensure the meeting room name is unique by trying a few times.
  for (let attempt = 0; attempt < 10; attempt++) {
    code = makeRoomName(name)
    const clash = await db.meeting.findUnique({ where: { code } })
    if (!clash) break
  }

  const meeting = await db.meeting.create({
    data: { name, code, hostId: userId },
    include: { host: { select: { name: true } } },
  })

  return NextResponse.json(
    {
      room: {
        id: meeting.id,
        name: meeting.name,
        code: meeting.code,
        hostName: meeting.host.name,
        isHost: true,
        isJoined: false,
        participantCount: 0,
        totalHours: 0,
      },
    },
    { status: 201 },
  )
}