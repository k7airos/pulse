import { loadSite } from '../../../../utils/siteRequest'
import { buildReport } from '../../../../utils/store/report'

/** One-call report: totals, daily series, optional comparison, top panels and goals. */
export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'read')
  return buildReport(site, getQuery(event))
})
