import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { resourceFolderSchema } from '@/lib/validation'

export async function PATCH(request: Request, ctx: RouteContext<'/api/resources/folders/[id]'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const existing = await db.resourceFolder.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const parsed = resourceFolderSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const data: { name?: string; sortOrder?: number } = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name

  const folder = await db.resourceFolder.update({ where: { id }, data })
  return NextResponse.json({ folder })
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/resources/folders/[id]'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const existing = await db.resourceFolder.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.resourceFolder.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
