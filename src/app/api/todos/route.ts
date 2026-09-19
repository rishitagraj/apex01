import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { todoSchema } from '@/lib/validation'

export async function GET() {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const todos = await db.todo.findMany({
    where: { userId },
    orderBy: [{ completed: 'asc' }, { priority: 'desc' }, { dueDate: 'asc' }],
  })

  return NextResponse.json({ todos })
}

export async function POST(request: Request) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = todoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { title, notes, priority, dueDate, scribble } = parsed.data
  const normalized = notes === '' || notes === undefined ? null : notes

  const todo = await db.todo.create({
    data: {
      userId,
      title,
      notes: normalized,
      scribble: typeof scribble === 'string' && scribble.length > 0 ? scribble : null,
      priority: priority ?? 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  })

  return NextResponse.json({ todo }, { status: 201 })
}