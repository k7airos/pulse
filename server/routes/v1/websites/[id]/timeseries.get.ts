import { loadSite, resolveRange } from '../../../../utils/siteRequest'
import { getTimeseries } from '../../../../utils/store/events'
import { parseFilters } from '../../../../utils/store/filters'

/** Daily pageviews / events / visitors (zero-filled) in the site's timezone. */
export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'read')
  const q = getQuery(event)
  const { startDay, endDay } = resolveRange(site, q, 30)
  return {
    websiteId: site.id,
    startDay,
    endDay,
    series: getTimeseries(site.id, startDay, endDay, parseFilters(q)),
  }
})
