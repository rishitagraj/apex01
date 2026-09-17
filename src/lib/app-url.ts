// Returns the public origin of the running app so emails/OAuth callbacks point
// at the real deployment instead of a proxy or localhost.
export function getAppUrl(requestUrl?: string): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '')
  }
  // Stable production host on Vercel (e.g. apex01.vercel.app). VERCEL_URL alone
  // is the per-deployment preview host and must NOT be used for OAuth/email
  // redirects. This env is injected automatically for every Vercel deployment.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (requestUrl) {
    return new URL(requestUrl).origin
  }
  // Vercel injected host as last resort (server-side contexts without a URL).
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}