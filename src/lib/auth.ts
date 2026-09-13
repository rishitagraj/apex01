import 'server-only'
import { cookies, headers } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const SESSION_COOKIE = 'apex01_session'
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-insecure-secret-change-me')
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function getSessionCookieName() {
  return SESSION_COOKIE
}

// A Secure cookie is dropped by browsers over plain HTTP, which breaks local
// development and LAN testing (localhost / private RFC1918 hosts). Only mark
// the cookie Secure when we are served over real HTTPS.
function isLocalHost(host: string): boolean {
  return /^(localhost|127(\.\d+){3}|192\.168|10(\.\d+){3}|172\.(1[6-9]|2\d|3[01])(\.\d+){2}|\[::1\]|\[fc(0[0-7]|[89a-f][0-9a-f]):)/i.test(
    host,
  )
}

async function cookieSecure(): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return false
  const host = (await headers().catch(() => null))?.get('host') ?? ''
  return !isLocalHost(host)
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: await cookieSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export async function deleteSession() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function verifySession(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret)
    if (typeof payload.userId === 'string') return payload.userId
    return null
  } catch {
    return null
  }
}