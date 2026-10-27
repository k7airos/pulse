import { loadSite, resolveRange } from '../../../../utils/siteRequest'
import { getTotals } from '../../../../utils/store/events'
import { parseFilters } from '../../../../utils/store/filters'
import { startOfDayKey, addDays } from '../../../../utils/tz'

/** Totals for a range. Accepts startAt/endAt (ms) or startDay/endDay, plus the usual filters. */
export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'read')
  const q = getQuery(event)
  const { startDay, endDay, tz } = resolveRange(site, q)
  const totals = getTotals(site.id, startDay, endDay, parseFilters(q))
  return {
    websiteId: site.id,
    publicId: site.publicId,
    ...totals,
    startDay,
    endDay,
    startAt: startOfDayKey(startDay, tz),
    endAt: Math.min(Date.now(), startOfDayKey(addDays(endDay, 1), tz) - 1),
  }
})
