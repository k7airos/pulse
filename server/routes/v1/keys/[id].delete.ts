import { assertWebsiteAccess, getKeyById, requireAuth, revokeKey } from '../../../utils/auth/apiKey'

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event, 'admin')
  const id = getRouterParam(event, 'id')!

  const key = await getKeyById(id)
  if (!key)
    throw createError({ statusCode: 404, statusMessage: 'Key not found' })

  // A site-bound admin may only revoke keys of its own site; global keys need a global admin.
  if (key.websiteId)
    assertWebsiteAccess(auth, key.websiteId)
  else if (auth.websiteId)
    throw createError({ statusCode: 403, statusMessage: 'Global admin key required' })

  return await revokeKey(id)
})
