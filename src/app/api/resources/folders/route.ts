import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { resourceFolderSchema } from '@/lib/validation'

export async function POST(request: Request) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = resourceFolderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const count = await db.resourceFolder.count({ where: { userId } })
  const folder = await db.resourceFolder.create({
    data: { userId, name: parsed.data.name, sortOrder: count },
  })

  return NextResponse.json({ folder }, { status: 201 })
}
