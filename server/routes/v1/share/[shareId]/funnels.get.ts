import { loadSharedSite } from '../../../../utils/siteRequest'
import { buildFunnels } from '../../../../utils/store/report'

export default defineEventHandler((event) => {
  return buildFunnels(loadSharedSite(event), getQuery(event))
})
