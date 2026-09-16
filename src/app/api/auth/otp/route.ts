import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'

const otpSchema = z.object({
  email: z.string().trim().email('Enter a valid email').toLowerCase(),
})

// Sends a one-time password (magic code) to the user's email for passwordless
// sign-in.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = otpSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const email = parsed.data.email
    const origin = getAppUrl(request.url)
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('otp send error', error)
    return NextResponse.json(
      { error: 'Something went wrong. Check your connection and try again.' },
      { status: 500 },
    )
  }
}