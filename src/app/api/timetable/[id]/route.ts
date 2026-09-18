import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { timetableDaySchema } from '@/lib/validation'

export async function PATCH(request: Request, ctx: RouteContext<'/api/timetable/[id]'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const existing = await db.timetableDay.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const parsed = timetableDaySchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const data: { name?: string; sortOrder?: number } = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder

  const day = await db.timetableDay.update({
    where: { id },
    data,
    include: { slots: { orderBy: [{ startAt: 'asc' }, { sortOrder: 'asc' }] } },
  })

  return NextResponse.json({ day })
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/timetable/[id]'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const existing = await db.timetableDay.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.timetableDay.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}