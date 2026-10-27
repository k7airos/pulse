import { loadSite } from '../../../../../utils/siteRequest'
import { deleteGoal } from '../../../../../utils/store/goals'

export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'admin')
  if (!deleteGoal(site.id, getRouterParam(event, 'goalId')!))
    throw createError({ statusCode: 404, statusMessage: 'Goal not found' })
  return { ok: true }
})
