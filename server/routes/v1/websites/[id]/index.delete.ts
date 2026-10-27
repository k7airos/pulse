import { assertGlobalAdmin, requireAuth, resolveWebsiteById } from '../../../../utils/auth/apiKey'
import { deleteSite } from '../../../../utils/store/maintenance'

/** Permanently delete a website with all its events, rollups, goals, funnels and keys. */
export default defineEventHandler(async (event) => {
  assertGlobalAdmin(await requireAuth(event, 'admin'))
  const id = getRouterParam(event, 'id')!
  if (!await resolveWebsiteById(id))
    throw createError({ statusCode: 404, statusMessage: 'Website not found' })
  deleteSite(id)
  return { ok: true, id }
})
