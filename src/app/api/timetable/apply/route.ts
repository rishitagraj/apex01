import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { timetableApplySchema } from '@/lib/validation'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = timetableApplySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { mode, days } = parsed.data

  try {
    const created = await db.$transaction(async (tx) => {
      if (mode === 'replace') {
        await tx.timetableDay.deleteMany({ where: { userId } })
      }
      const base =
        mode === 'replace'
          ? 0
          : await tx.timetableDay.count({ where: { userId } })

      const out = []
      for (let i = 0; i < days.length; i++) {
        const draftDay = days[i]
        const day = await tx.timetableDay.create({
          data: {
            userId,
            name: draftDay.name,
            sortOrder: base + i,
            slots: {
              create: draftDay.slots.map((s, j) => ({
                subject: s.subject,
                startAt: s.startAt,
                endAt: s.endAt,
                notes: s.notes && s.notes.length > 0 ? s.notes : null,
                sortOrder: j,
              })),
            },
          },
          include: {
            slots: { orderBy: [{ startAt: 'asc' }, { sortOrder: 'asc' }] },
          },
        })
        out.push(day)
      }
      return out
    })

    return NextResponse.json({ ok: true, days: created }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: String((err as Error)?.message ?? err), code: 'APPLY_ERROR' },
      { status: 500 },
    )
  }
}
