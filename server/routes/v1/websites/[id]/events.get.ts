import { assertWebsiteAccess, requireAuth, resolveWebsiteById } from '../../../../utils/auth/apiKey'
import { intParam, rangeParams } from '../../../../utils/http'
import { listEvents } from '../../../../utils/store/events'

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event, 'read')
  const id = getRouterParam(event, 'id')!
  assertWebsiteAccess(auth, id)

  const website = await resolveWebsiteById(id)
  if (!website)
    throw createError({ statusCode: 404, statusMessage: 'Website not found' })

  const q = getQuery(event)
  const { startAt, endAt } = rangeParams(q)
  const name = typeof q.name === 'string' ? q.name.slice(0, 128) : undefined
  const pathPrefix = typeof q.pathPrefix === 'string' ? q.pathPrefix.slice(0, 512) : undefined
  const limit = intParam(q.limit, 50, 1, 200)

  const rows = await listEvents({ websiteId: id, name, pathPrefix, startAt, endAt, limit })
  return { websiteId: id, events: rows }
})
