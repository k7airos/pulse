import { z } from 'zod'
import { parseWith, readJsonBody } from '../../../../utils/http'
import { loadSite } from '../../../../utils/siteRequest'
import { createGoal, listGoals } from '../../../../utils/store/goals'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(128),
  type: z.enum(['path', 'event']),
  value: z.string().trim().min(1).max(256),
}).refine(g => g.type !== 'path' || g.value.startsWith('/'), { message: 'path goals must start with "/" (end with * for a prefix)', path: ['value'] })

export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'admin')
  const body = parseWith(bodySchema, await readJsonBody(event, 2 * 1024))
  if (listGoals(site.id).length >= 50)
    throw createError({ statusCode: 400, statusMessage: 'Goal limit (50) reached' })
  return { goal: createGoal(site.id, body) }
})
