import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'

const forgotSchema = z.object({
  email: z.string().trim().email('Enter a valid email').toLowerCase(),
})

// Sends a password-recovery email via Supabase. The email contains a link that
// lands on /auth/callback?next=/reset-password with a session code.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = forgotSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const origin = getAppUrl(request.url)
    const supabase = await createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Always return OK regardless of whether the account exists, to avoid
    // leaking which emails are registered.
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('forgot-password error', error)
    return NextResponse.json(
      { error: 'Something went wrong. Check your connection and try again.' },
      { status: 500 },
    )
  }
}