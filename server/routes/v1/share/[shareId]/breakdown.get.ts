import { loadSharedSite } from '../../../../utils/siteRequest'
import { buildBreakdown } from '../../../../utils/store/report'

export default defineEventHandler((event) => {
  return buildBreakdown(loadSharedSite(event), getQuery(event))
})
