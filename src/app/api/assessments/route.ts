import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { assessmentSchema } from '@/lib/validation'

export async function GET() {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assessments = await db.assessment.findMany({
    where: { userId },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json({ assessments })
}

export async function POST(request: Request) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = assessmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { subject, title, type, dueDate, weight, status, notes } = parsed.data

  const assessment = await db.assessment.create({
    data: {
      userId,
      subject,
      title,
      type: type ?? 'EXAM',
      dueDate: dueDate ? new Date(dueDate) : null,
      weight,
      status: status ?? 'PLANNED',
      notes: notes === '' ? null : notes,
    },
  })

  return NextResponse.json({ assessment }, { status: 201 })
}