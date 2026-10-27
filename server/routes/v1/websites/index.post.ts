import { z } from 'zod'
import { websites } from '../../../database/schema'
import { assertGlobalAdmin, createApiKey, requireAuth } from '../../../utils/auth/apiKey'
import { useDb } from '../../../utils/db'
import { parseWith, readJsonBody } from '../../../utils/http'
import { newId, newPublicId } from '../../../utils/ids'
import { isValidTz } from '../../../utils/tz'

const bodySchema = z.object({
  name: z.string().min(1).max(128),
  domain: z.string().max(256).optional().nullable(),
  /** IANA timezone for day boundaries; default = server zone. */
  timezone: z.string().optional().nullable(),
  /** If true, also create a site-scoped key with collect+read */
  withKeys: z.boolean().optional().default(true),
})

export default defineEventHandler(async (event) => {
  // Creating sites is a global operation: a site-bound admin key must not do it.
  assertGlobalAdmin(await requireAuth(event, 'admin'))
  const body = parseWith(bodySchema, await readJsonBody(event, 4 * 1024))

  if (body.timezone && !isValidTz(body.timezone))
    throw createError({ statusCode: 400, statusMessage: 'Invalid timezone (IANA name expected)' })

  const id = newId('site')
  const publicId = newPublicId()
  const now = Date.now()
  const db = useDb()

  await db.insert(websites).values({
    id,
    name: body.name,
    domain: body.domain || null,
    publicId,
    createdAt: now,
    timezone: body.timezone || null,
  })

  let keys: Awaited<ReturnType<typeof createApiKey>>[] = []
  if (body.withKeys) {
    const collect = await createApiKey({
      websiteId: id,
      name: `${body.name}-collect`,
      scopes: ['collect'],
    })
    const read = await createApiKey({
      websiteId: id,
      name: `${body.name}-read`,
      scopes: ['read'],
    })
    keys = [collect, read]
  }

  return {
    website: { id, name: body.name, domain: body.domain || null, publicId, createdAt: now, timezone: body.timezone || null },
    keys, // plain keys only on create
  }
})
