import { z } from 'zod'
import { parseWith, readJsonBody } from '../../../../utils/http'
import { loadSite } from '../../../../utils/siteRequest'
import { createFunnel, listFunnels } from '../../../../utils/store/funnels'

const step = z.object({
  type: z.enum(['path', 'event']),
  value: z.string().trim().min(1).max(256),
}).refine(s => s.type !== 'path' || s.value.startsWith('/'), { message: 'path steps must start with "/"', path: ['value'] })

const bodySchema = z.object({
  name: z.string().trim().min(1).max(128),
  steps: z.array(step).min(2).max(8),
  /** Max minutes allowed between consecutive steps. */
  windowMinutes: z.number().int().min(1).max(10080).default(1440),
})

export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'admin')
  const body = parseWith(bodySchema, await readJsonBody(event, 4 * 1024))
  if (listFunnels(site.id).length >= 20)
    throw createError({ statusCode: 400, statusMessage: 'Funnel limit (20) reached' })
  return { funnel: createFunnel(site.id, body) }
})
