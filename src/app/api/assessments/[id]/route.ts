import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { assessmentSchema } from '@/lib/validation'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Params) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const existing = await db.assessment.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const parsed = assessmentSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const data: {
    subject?: string
    title?: string
    type?: 'EXAM' | 'QUIZ' | 'ASSIGNMENT' | 'PROJECT' | 'OTHER'
    dueDate?: Date | null
    weight?: number | null
    status?: 'PLANNED' | 'STUDYING' | 'READY' | 'DONE'
    notes?: string | null
  } = {}

  if (parsed.data.subject !== undefined) data.subject = parsed.data.subject
  if (parsed.data.title !== undefined) data.title = parsed.data.title
  if (parsed.data.type !== undefined) data.type = parsed.data.type
  if (parsed.data.dueDate !== undefined) {
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
  }
  if (parsed.data.weight !== undefined) data.weight = parsed.data.weight
  if (parsed.data.status !== undefined) data.status = parsed.data.status
  if (parsed.data.notes !== undefined) {
    data.notes = parsed.data.notes === '' || parsed.data.notes === null ? null : parsed.data.notes
  }

  const assessment = await db.assessment.update({ where: { id }, data })
  return NextResponse.json({ assessment })
}

export async function DELETE(request: Request, ctx: Params) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const existing = await db.assessment.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.assessment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}