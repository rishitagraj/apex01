import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { resourcePublicFileUrl } from '@/lib/resources'

export async function GET() {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [folders, items, library] = await Promise.all([
    db.resourceFolder.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    db.resourceItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    // The public library is every uploaded file from every account, plus the
    // signed-in user's own saved links. Folders and ownership stay private.
    db.resourceItem.findMany({
      where: {
        OR: [{ fileKey: { not: null } }, { userId }],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        folderId: true,
        kind: true,
        title: true,
        url: true,
        notes: true,
        fileKey: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        createdAt: true,
        userId: true,
        user: { select: { name: true } },
      },
    }),
  ])

  const libraryItems = library.map(({ userId: ownerId, user, ...item }) => ({
    ...item,
    // Other users' folders are private, so only surface the viewer's folder ids.
    folderId: ownerId === userId ? item.folderId : null,
    // Public files are always opened through the public delivery route.
    url: item.fileKey ? resourcePublicFileUrl(item.fileKey) : item.url,
    ownerName: user.name,
    isOwner: ownerId === userId,
  }))

  return NextResponse.json({ folders, items, libraryItems })
}
