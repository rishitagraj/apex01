import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { resourceItemSchema } from '@/lib/validation'
import { detectResourceKind, hostnameOf, normalizeUrl } from '@/lib/resources'

export async function POST(request: Request) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = resourceItemSchema.safeParse(body)
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

  const finalUrl = normalizeUrl(url)
  const finalKind = kind ?? detectResourceKind(finalUrl)
  const finalTitle = title?.trim() ? title.trim() : hostnameOf(finalUrl)

  const item = await db.resourceItem.create({
    data: {
      userId,
      folderId: folderId ?? null,
      kind: finalKind,
      title: finalTitle,
      url: finalUrl,
      notes: notes?.trim() ? notes.trim() : null,
    },
  })

  return NextResponse.json({ item }, { status: 201 })
}
