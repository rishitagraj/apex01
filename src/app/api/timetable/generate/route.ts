import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { timetableGenerateSchema } from '@/lib/validation'
import {
  generateTimetableDraft,
  TimetableAiNotConfiguredError,
} from '@/lib/timetable-ai'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  const userId = await verifySession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = timetableGenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const input = parsed.data

  // Need at least some signal about the day, otherwise the plan is meaningless.
  const hasSignal =
    input.description.trim().length > 0 ||
    input.homeTime.length > 0 ||
    input.schoolEnd.length > 0 ||
    input.priorities.length > 0
  if (!hasSignal) {
    return NextResponse.json(
      {
        error:
          'Tell the planner a bit about your day first (e.g. when you get home, or describe your average day).',
      },
      { status: 400 },
    )
  }

  try {
    const result = await generateTimetableDraft(input, parsed.data.model)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof TimetableAiNotConfiguredError) {
      return NextResponse.json(
        {
          error:
            'The AI planner is not configured. Add GEMINI_API_KEY or GROQ_API_KEY to enable it.',
          code: 'NOT_CONFIGURED',
        },
        { status: 503 },
      )
    }
    console.error('timetable generate error', err)
    return NextResponse.json(
      {
        error:
          'The AI planner is busy right now. Please try again in a moment.',
        code: 'AI_ERROR',
      },
      { status: 502 },
    )
  }
}
