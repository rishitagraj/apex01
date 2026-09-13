import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { getDashboardStats } from '@/lib/queries'

export async function GET() {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [stats, todos] = await Promise.all([
    getDashboardStats(userId),
    db.todo.findMany({
      where: { userId },
      orderBy: [{ completed: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
    }),
  ])

  return NextResponse.json({ stats, todos })
}