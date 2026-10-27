import { assertWebsiteAccess, requireAuth, resolveWebsiteById } from '../../../../utils/auth/apiKey'
import { getWebsiteOverview } from '../../../../utils/store/overview'

/**
 * Multi-window stats with period-over-period change (1d / 7d / 30d).
 * Windows are calendar-day aligned (local midnight), not rolling 24h.
 */
export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event, 'read')
  const id = getRouterParam(event, 'id')!
  assertWebsiteAccess(auth, id)

  const website = await resolveWebsiteById(id)
  if (!website)
    throw createError({ statusCode: 404, statusMessage: 'Website not found' })

  const overview = getWebsiteOverview(website)
  return {
    websiteId: id,
    publicId: website.publicId,
    name: website.name,
    ...overview,
  }
})
