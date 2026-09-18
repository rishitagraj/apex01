import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { timetableSlotSchema } from '@/lib/validation'

export async function PATCH(request: Request, ctx: RouteContext<'/api/timetable/slots/[id]'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const existing = await db.timetableSlot.findFirst({
    where: { id, day: { userId } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const parsed = timetableSlotSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const data: {
    subject?: string
    startAt?: string
    endAt?: string
    notes?: string | null
    sortOrder?: number
  } = {}

  if (parsed.data.subject !== undefined) data.subject = parsed.data.subject
  if (parsed.data.startAt !== undefined) data.startAt = parsed.data.startAt
  if (parsed.data.endAt !== undefined) data.endAt = parsed.data.endAt
  if (parsed.data.notes !== undefined) {
    data.notes = parsed.data.notes === '' || parsed.data.notes === null ? null : parsed.data.notes
  }
  if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder

  const slot = await db.timetableSlot.update({ where: { id }, data })
  return NextResponse.json({ slot })
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/timetable/slots/[id]'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const existing = await db.timetableSlot.findFirst({
    where: { id, day: { userId } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.timetableSlot.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}