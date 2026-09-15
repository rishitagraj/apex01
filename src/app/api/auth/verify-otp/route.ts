import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'

const verifySchema = z.object({
  email: z.string().trim().email('Enter a valid email').toLowerCase(),
  token: z.string().trim().min(6, 'Enter the 6-digit code').max(6),
  type: z.enum(['email', 'signup', 'recovery']).default('email'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { email, token, type } = parsed.data
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    })
    if (error) {
      return NextResponse.json(
        { error: 'That code is invalid or expired. Request a new one and try again.' },
        { status: 401 },
      )
    }

    const { user } = await getAuthUser()
    return NextResponse.json({ user })
  } catch (error) {
    console.error('otp verify error', error)
    return NextResponse.json(
      { error: 'Something went wrong. Check your connection and try again.' },
      { status: 500 },
    )
  }
}