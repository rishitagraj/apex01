import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { createSession } from '@/lib/auth'
import { loginSchema } from '@/lib/validation'
import { verifySession } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { email, password } = parsed.data

    const user = await db.user.findUnique({ where: { email } })
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 },
      )
    }

    await createSession(user.id)

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
    })
  } catch (error) {
    console.error('login error', error)
    return NextResponse.json(
      { error: 'Something went wrong. Check your connection and try again.' },
      { status: 500 },
    )
  }
}

export async function GET() {
  const userId = await verifySession()
  if (!userId) {
    return NextResponse.json({ user: null })
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, totalMinutes: true, isAdmin: true },
  })
  return NextResponse.json({ user })
}