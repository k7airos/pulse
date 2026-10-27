import { loadSite } from '../../../../utils/siteRequest'
import { buildBreakdown } from '../../../../utils/store/report'

export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'read')
  return buildBreakdown(site, getQuery(event))
})
