import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { createSession } from '@/lib/auth'
import { registerSchema } from '@/lib/validation'

/** Neon pooled databases can cold-start: the first connection may briefly fail. */
function isRetryable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes('P1001') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('connect timeout') ||
    msg.includes('Connection terminated') ||
    msg.includes('getaddrinfo')
  )
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: { email: ['An account with this email already exists.'] } },
        { status: 409 },
      )
    }

    const passwordHash = await hashPassword(password)
    try {
      const user = await db.user.create({
        data: { name, email, passwordHash },
      })

      await createSession(user.id)

      return NextResponse.json({
        user: { id: user.id, name: user.name, email: user.email },
      })
    } catch (createError) {
      if (isRetryable(createError)) {
        // Neon cold start: give the pool a moment, then try once more.
        await sleep(1500)
        const user = await db.user.create({
          data: { name, email, passwordHash },
        })
        await createSession(user.id)
        return NextResponse.json({
          user: { id: user.id, name: user.name, email: user.email },
        })
      }
      // Race: someone registered the same email between the check and create.
      if (createError instanceof Error && createError.message.includes('P2002')) {
        return NextResponse.json(
          { error: { email: ['An account with this email already exists.'] } },
          { status: 409 },
        )
      }
      throw createError
    }
  } catch (error) {
    console.error('register error', error)
    return NextResponse.json(
      { error: 'Something went wrong. Check your connection and try again.' },
      { status: 500 },
    )
  }
}