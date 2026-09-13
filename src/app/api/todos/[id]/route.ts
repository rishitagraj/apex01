import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { todoSchema } from '@/lib/validation'

export async function PATCH(request: Request, ctx: RouteContext<'/api/todos/[id]'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const existing = await db.todo.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const parsed = todoSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const data: {
    title?: string
    notes?: string | null
    priority?: 'LOW' | 'MEDIUM' | 'HIGH'
    dueDate?: Date | null
    completed?: boolean
  } = {}

  if (parsed.data.title !== undefined) data.title = parsed.data.title
  if (parsed.data.notes !== undefined) {
    data.notes = parsed.data.notes === '' || parsed.data.notes === null ? null : parsed.data.notes
  }
  if (parsed.data.priority !== undefined) data.priority = parsed.data.priority
  if (parsed.data.dueDate !== undefined) {
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
  }
  if (typeof body.completed === 'boolean') data.completed = body.completed

  const todo = await db.todo.update({ where: { id }, data })
  return NextResponse.json({ todo })
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/todos/[id]'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const existing = await db.todo.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.todo.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}