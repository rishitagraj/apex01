import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { timetableDaySchema } from '@/lib/validation'

export async function GET() {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = await db.timetableDay.findMany({
    where: { userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { slots: { orderBy: [{ startAt: 'asc' }, { sortOrder: 'asc' }] } },
  })

  return NextResponse.json({ days })
}

export async function POST(request: Request) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = timetableDaySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { name } = parsed.data
  const count = await db.timetableDay.count({ where: { userId } })

  const day = await db.timetableDay.create({
    data: { userId, name, sortOrder: count },
    include: { slots: true },
  })

  return NextResponse.json({ day }, { status: 201 })
}