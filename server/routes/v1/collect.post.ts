import {
  extractApiKey,
  hasScope,
  resolveWebsiteByPublicId,
  verifyApiKey,
} from '../../utils/auth/apiKey'
import { collectBodySchema } from '../../utils/collectParse'
import { countryOf, isBot, normLanguage, parseUA } from '../../utils/enrich'
import { clientIp, parseWith, readJsonBody } from '../../utils/http'
import { assertOriginAllowed } from '../../utils/originGuard'
import { rateLimit } from '../../utils/rateLimit'
import { ingestEvent } from '../../utils/store/events'

/**
 * Browser: website publicId only (Origin must match the site's domain when one is set).
 * Agent: x-api-key with collect scope can post for any site (or bound site).
 */
export default defineEventHandler(async (event) => {
  const ip = clientIp(event)
  if (!rateLimit(`collect:${ip}`, 180, 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit' })
  }

  // JSON or text/plain JSON (the browser tracker uses text/plain to skip preflight); 16 KB cap.
  const body = parseWith(collectBodySchema, await readJsonBody(event, 16 * 1024))

  const site = await resolveWebsiteByPublicId(body.websiteId)
  if (!site) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown websiteId (public id)' })
  }

  // If an API key is present it must be valid, scoped to collect and bound to this site.
  const plain = extractApiKey(event)
  let trusted = false
  if (plain) {
    const auth = await verifyApiKey(plain)
    if (!auth || !hasScope(auth, 'collect')) {
      throw createError({ statusCode: 403, statusMessage: 'Invalid collect key' })
    }
    if (auth.websiteId && auth.websiteId !== site.id) {
      throw createError({ statusCode: 403, statusMessage: 'Key not allowed for website' })
    }
    trusted = true
  }
  else {
    assertOriginAllowed(event, site.domain)
  }

  if (body.type === 'event' && !body.name) {
    throw createError({ statusCode: 400, statusMessage: 'event name required' })
  }

  // Anonymous traffic: ignore crawlers (accepted but not recorded) and derive the
  // environment from the request itself. Trusted keys may supply their own values.
  const ua = getRequestHeader(event, 'user-agent')
  if (!trusted && isBot(ua))
    return { ok: true, accepted: 0 }
  const parsed = parseUA(ua)
  const env = {
    browser: (trusted && body.browser) || parsed.browser,
    os: (trusted && body.os) || parsed.os,
    device: (trusted && body.device) || parsed.device,
    country: (trusted && body.country?.toUpperCase()) || countryOf(event.node.req.headers as Record<string, string | undefined>, ip),
    language: normLanguage(body.language || getRequestHeader(event, 'accept-language')?.split(',')[0]),
  }

  const result = await ingestEvent({
    website: site,
    type: body.type,
    name: body.name,
    path: body.path,
    url: body.url,
    referrer: body.referrer,
    props: body.props,
    sessionId: body.sessionId,
    visitorId: body.visitorId,
    // Anonymous browsers cannot choose the timestamp; trusted keys can backfill.
    ts: trusted ? body.ts : undefined,
    env,
  })

  setResponseStatus(event, 202)
  return { ok: true, accepted: 1, id: result.id }
})
