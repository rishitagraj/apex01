import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().trim().email('Enter a valid email').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { name, email, password } = parsed.data
    const supabase = await createClient()

    const origin = new URL(request.url).origin
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    })

    if (error) {
      let message = error.message
      if (/already registered/i.test(message)) {
        message = 'An account with this email already exists. Sign in instead.'
      }
      return NextResponse.json({ error: { email: [message] } }, { status: 409 })
    }

    const user = data.user
    return NextResponse.json({
      user: user ? { id: user.id, name, email } : null,
      // When email confirmation is enabled (the default), Supabase returns no
      // session: the user must click the link / enter the OTP in the email.
      needsEmailVerification: !data.session,
    })
  } catch (error) {
    console.error('register error', error)
    return NextResponse.json(
      { error: 'Something went wrong. Check your connection and try again.' },
      { status: 500 },
    )
  }
}