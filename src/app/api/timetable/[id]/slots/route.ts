import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { timetableSlotSchema } from '@/lib/validation'

export async function POST(request: Request, ctx: RouteContext<'/api/timetable/[id]/slots'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const day = await db.timetableDay.findFirst({ where: { id, userId } })
  if (!day) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const parsed = timetableSlotSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { subject, startAt, endAt, notes } = parsed.data
  const count = await db.timetableSlot.count({ where: { dayId: id } })

  const slot = await db.timetableSlot.create({
    data: {
      dayId: id,
      subject,
      startAt,
      endAt,
      notes: notes === '' ? null : notes,
      sortOrder: count,
    },
  })

  return NextResponse.json({ slot }, { status: 201 })
}