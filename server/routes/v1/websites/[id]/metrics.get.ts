import { intParam } from '../../../../utils/http'
import { loadSite, resolveRange } from '../../../../utils/siteRequest'
import { getBreakdown } from '../../../../utils/store/events'
import { FILTER_KEYS, parseFilters } from '../../../../utils/store/filters'
import type { FilterKey } from '../../../../utils/store/filters'

/**
 * Top values of a dimension. `type` is path | event | referrer (legacy shapes) or any
 * other filter dimension (channel, utm_*, country, browser, os, device, language).
 */
export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'read')
  const q = getQuery(event)
  const type = (typeof q.type === 'string' && q.type) || 'path'
  if (!FILTER_KEYS.includes(type as FilterKey)) {
    throw createError({ statusCode: 400, statusMessage: `type must be one of ${FILTER_KEYS.join('|')}` })
  }
  const { startDay, endDay } = resolveRange(site, q)
  const rows = getBreakdown(site.id, type as FilterKey, startDay, endDay, parseFilters(q), intParam(q.limit, 20, 1, 100))

  const metrics = rows.map((r) => {
    if (type === 'path')
      return { x: r.x, pageviews: r.count, visitors: r.visitors }
    if (type === 'event')
      return { x: r.x, events: r.count, visitors: r.visitors }
    return { x: r.x, count: r.count, visitors: r.visitors }
  })
  return { websiteId: site.id, type, startDay, endDay, metrics }
})
