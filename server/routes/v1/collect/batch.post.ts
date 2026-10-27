import {
  extractApiKey,
  hasScope,
  resolveWebsiteByPublicId,
  verifyApiKey,
} from '../../../utils/auth/apiKey'
import { collectBatchSchema } from '../../../utils/collectParse'
import { normLanguage } from '../../../utils/enrich'
import { parseWith, readJsonBody } from '../../../utils/http'
import { rateLimit } from '../../../utils/rateLimit'
import { ingestEvent } from '../../../utils/store/events'

export default defineEventHandler(async (event) => {
  const plain = extractApiKey(event)
  if (!plain) {
    throw createError({ statusCode: 401, statusMessage: 'Batch collect requires API key' })
  }
  const auth = await verifyApiKey(plain)
  if (!auth || !hasScope(auth, 'collect')) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid collect key' })
  }

  if (!rateLimit(`batch:${auth.keyId}`, 60, 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit' })
  }

  const body = parseWith(collectBatchSchema, await readJsonBody(event, 512 * 1024))
  const ids: string[] = []

  for (const item of body.items) {
    const site = await resolveWebsiteByPublicId(item.websiteId)
    if (!site)
      continue
    if (auth.websiteId && auth.websiteId !== site.id)
      continue
    if (item.type === 'event' && !item.name)
      continue

    const r = await ingestEvent({
      website: site,
      type: item.type,
      name: item.name,
      path: item.path,
      url: item.url,
      referrer: item.referrer,
      props: item.props,
      sessionId: item.sessionId,
      visitorId: item.visitorId,
      ts: item.ts,
      env: {
        browser: item.browser,
        os: item.os,
        device: item.device,
        country: item.country?.toUpperCase(),
        language: normLanguage(item.language),
      },
    })
    ids.push(r.id)
  }

  setResponseStatus(event, 202)
  return { ok: true, accepted: ids.length, ids }
})
