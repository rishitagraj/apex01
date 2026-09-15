import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Returns the Google authorization URL; the client performs the redirect.
export async function POST(request: Request) {
  try {
    const origin = new URL(request.url).origin
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ url: data.url })
  } catch (error) {
    console.error('google oauth error', error)
    return NextResponse.json(
      { error: 'Something went wrong. Check your connection and try again.' },
      { status: 500 },
    )
  }
}