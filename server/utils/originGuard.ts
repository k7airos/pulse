import type { H3Event } from 'h3'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/** "https://App.Example.com:443/x" → "app.example.com" */
function toHost(v: string) {
  const s = v.trim().toLowerCase()
  if (!s)
    return ''
  try {
    return new URL(s.includes('://') ? s : `https://${s}`).hostname.replace(/^www\./, '')
  }
  catch {
    return ''
  }
}

/** Does `origin` (an Origin/Referer value) belong to the site's registered domain(s)? */
export function originMatchesDomain(domainSpec: string, origin: string) {
  const host = toHost(origin)
  if (!host)
    return false
  if (LOCAL_HOSTS.has(host))
    return true
  return domainSpec.split(',').map(toHost).filter(Boolean).some(d => host === d || host.endsWith(`.${d}`))
}

/**
 * Browser collect without an API key: when the site has a domain registered, the
 * request's Origin (or Referer) must be that domain or a subdomain.
 * This stops other websites from polluting your numbers; it cannot stop a
 * non-browser client that forges headers (public-id collect is unauthenticated by design).
 * Set PULSE_ENFORCE_ORIGIN=0 to turn the check off.
 */
export function assertOriginAllowed(event: H3Event, domain: string | null) {
  if (!domain || process.env.PULSE_ENFORCE_ORIGIN === '0')
    return
  const origin = getRequestHeader(event, 'origin')
  const from = origin && origin !== 'null' ? origin : getRequestHeader(event, 'referer')
  if (!from)
    return // curl / server-side callers
  if (!originMatchesDomain(domain, from))
    throw createError({ statusCode: 403, statusMessage: 'Origin not allowed for this website' })
}
