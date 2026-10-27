import { loadSite, resolveRange } from '../../../../utils/siteRequest'
import { getTotals } from '../../../../utils/store/events'
import { parseFilters } from '../../../../utils/store/filters'
import { goalStats, listGoals } from '../../../../utils/store/goals'

export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'read')
  const q = getQuery(event)
  const { startDay, endDay } = resolveRange(site, q)
  const filters = parseFilters(q)
  const total = getTotals(site.id, startDay, endDay, filters).visitors
  return { startDay, endDay, goals: listGoals(site.id).map(g => ({ ...g, ...goalStats(site.id, g, startDay, endDay, filters, total) })) }
})
