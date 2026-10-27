import { assertWebsiteAccess, requireAuth, resolveWebsiteById } from '../../../../utils/auth/apiKey'
import { intParam } from '../../../../utils/http'
import { getInterest } from '../../../../utils/store/events'

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event, 'read')
  const id = getRouterParam(event, 'id')!
  assertWebsiteAccess(auth, id)

  const website = await resolveWebsiteById(id)
  if (!website)
    throw createError({ statusCode: 404, statusMessage: 'Website not found' })

  const q = getQuery(event)
  const days = intParam(q.days, 7, 1, 30)
  const pathPrefix = typeof q.pathPrefix === 'string' ? q.pathPrefix.slice(0, 512) : undefined
  const eventName = typeof q.eventName === 'string' ? q.eventName.slice(0, 128) : undefined

  if (!pathPrefix && !eventName) {
    throw createError({ statusCode: 400, statusMessage: 'pathPrefix or eventName required' })
  }

  const result = await getInterest({
    websiteId: id,
    pathPrefix,
    eventName,
    days,
  })
  return { websiteId: id, publicId: website.publicId, ...result }
})
