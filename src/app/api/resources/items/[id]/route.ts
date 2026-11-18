import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { resourceItemSchema } from '@/lib/validation'
import { normalizeUrl } from '@/lib/resources'
import { deleteResourceObject } from '@/lib/resource-storage'

export async function PATCH(request: Request, ctx: RouteContext<'/api/resources/items/[id]'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const existing = await db.resourceItem.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const parsed = resourceItemSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { folderId, kind, title, url, notes } = parsed.data

  if (folderId) {
    const folder = await db.resourceFolder.findFirst({
      where: { id: folderId, userId },
      select: { id: true },
    })
    if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  const data: {
    folderId?: string | null
    kind?: typeof kind
    title?: string
    url?: string
    notes?: string | null
  } = {}

  if (folderId !== undefined) data.folderId = folderId
  if (kind !== undefined && !existing.fileKey) data.kind = kind
  if (title !== undefined) data.title = title.trim() || existing.title
  if (url !== undefined && !existing.fileKey) data.url = normalizeUrl(url)
  if (notes !== undefined) data.notes = notes.trim() ? notes.trim() : null

  const item = await db.resourceItem.update({ where: { id }, data })
  return NextResponse.json({ item })
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/resources/items/[id]'>) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const existing = await db.resourceItem.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (existing.fileKey) {
    try {
      await deleteResourceObject(existing.fileKey)
    } catch (err) {
      // Keep deletion working even if storage is temporarily unavailable.
      console.error('resource file delete failed', err)
    }
  }

  await db.resourceItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
