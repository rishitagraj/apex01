import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const resetSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
})

// Updates the signed-in user's password (reached via the recovery email →
// /auth/callback → this page). Requires an authenticated recovery session.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = resetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('reset-password error', error)
    return NextResponse.json(
      { error: 'Something went wrong. Check your connection and try again.' },
      { status: 500 },
    )
  }
}