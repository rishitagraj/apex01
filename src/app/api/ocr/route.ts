import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'

const MAX_IMAGE_CHARS = 6 * 1024 * 1024 // ~6MB of raw base64 before inflating checks
const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate'

function extractBase64(image: string): string | null {
  if (image.startsWith('data:')) {
    const match = image.match(/^data:image\/[\w.+-]+;base64,(.+)$/)
    return match ? match[1] : null
  }
  return image.length > 0 ? image : null
}

export async function GET() {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ configured: Boolean(process.env.GOOGLE_VISION_API_KEY) })
}

export async function POST(request: Request) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.GOOGLE_VISION_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'OCR not configured', code: 'NOT_CONFIGURED' }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  const image = typeof body?.image === 'string' ? body.image : ''
  const base64 = extractBase64(image)
  if (!base64) {
    return NextResponse.json({ error: 'Missing image', code: 'BAD_REQUEST' }, { status: 400 })
  }
  if (base64.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: 'Image too large', code: 'TOO_LARGE' }, { status: 400 })
  }

  try {
    const res = await fetch(VISION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })

    const json = await res.json().catch(() => null)
    if (!res.ok) {
      const message = json?.error?.message || `Vision API error ${res.status}`
      if (res.status === 400) {
        return NextResponse.json({ error: message, code: 'VISION_BAD_REQUEST' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Vision service error', code: 'VISION_ERROR' }, { status: 502 })
    }

    const text = json?.responses?.[0]?.textAnnotations?.[0]?.description
    return NextResponse.json({ text: typeof text === 'string' && text.trim() ? text.trim() : '' })
  } catch (err) {
    const message = err instanceof Error && err.name === 'TimeoutError' ? 'Vision API timed out' : 'Vision service unavailable'
    return NextResponse.json({ error: message, code: 'VISION_ERROR' }, { status: 502 })
  }
}