// Returns the public origin of the running app so emails/OAuth callbacks point
// at the real deployment instead of a proxy or localhost.
export function getAppUrl(requestUrl?: string): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '')
  }
  // Vercel injects VERCEL_URL automatically (e.g. apex01.vercel.app).
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  if (requestUrl) {
    return new URL(requestUrl).origin
  }
  return 'http://localhost:3000'
}