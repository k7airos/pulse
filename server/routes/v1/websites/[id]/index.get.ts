import { assertWebsiteAccess, requireAuth, resolveWebsiteById } from '../../../../utils/auth/apiKey'

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event, 'read')
  const id = getRouterParam(event, 'id')!
  assertWebsiteAccess(auth, id)
  const website = await resolveWebsiteById(id)
  if (!website)
    throw createError({ statusCode: 404, statusMessage: 'Website not found' })
  return { website }
})
