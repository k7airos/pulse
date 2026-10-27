import { loadSite } from '../../../../utils/siteRequest'
import { buildFunnels } from '../../../../utils/store/report'

export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'read')
  return buildFunnels(site, getQuery(event))
})
