import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'

export async function GET() {
  const userId = await verifySession()

  const users = await db.user.findMany({
    orderBy: { totalMinutes: 'desc' },
    take: 100,
    select: {
      id: true,
      name: true,
      totalMinutes: true,
      createdAt: true,
    },
  })

  const viewer = await db.user.findUnique({
    where: { id: userId ?? 'does-not-exist' },
    select: { id: true, name: true, totalMinutes: true },
  })

  const ranks = users.map((u, i) => ({ rank: i + 1, ...u }))

  return NextResponse.json({
    leaderboard: ranks,
    viewerId: viewer?.id ?? null,
    viewerRank: ranks.find((r) => r.id === viewer?.id)?.rank ?? null,
    viewerMinutes: viewer?.totalMinutes ?? 0,
  })
}