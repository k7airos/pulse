import { z } from 'zod'
import { parseWith, readJsonBody } from '../../../../utils/http'
import { assertWebsiteAccess, createApiKey, requireAuth, resolveWebsiteById, type Scope } from '../../../../utils/auth/apiKey'

const bodySchema = z.object({
  name: z.string().min(1).max(128),
  scopes: z.array(z.enum(['collect', 'read', 'admin'])).min(1),
})

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event, 'admin')
  const id = getRouterParam(event, 'id')!
  assertWebsiteAccess(auth, id)

  const website = await resolveWebsiteById(id)
  if (!website)
    throw createError({ statusCode: 404, statusMessage: 'Website not found' })

  const body = parseWith(bodySchema, await readJsonBody(event, 4 * 1024))
  const key = await createApiKey({
    websiteId: id,
    name: body.name,
    scopes: body.scopes as Scope[],
  })
  return { key }
})
