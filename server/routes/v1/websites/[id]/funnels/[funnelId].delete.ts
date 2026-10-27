import { loadSite } from '../../../../../utils/siteRequest'
import { deleteFunnel } from '../../../../../utils/store/funnels'

export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'admin')
  if (!deleteFunnel(site.id, getRouterParam(event, 'funnelId')!))
    throw createError({ statusCode: 404, statusMessage: 'Funnel not found' })
  return { ok: true }
})
