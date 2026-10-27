import { z } from 'zod'
import { useSqlite } from '../../../../utils/db'
import { parseWith, readJsonBody } from '../../../../utils/http'
import { loadSite } from '../../../../utils/siteRequest'
import { effectiveRetentionDays, pruneSite } from '../../../../utils/store/maintenance'

const bodySchema = z.object({ days: z.number().int().min(1).max(3650).optional() })

/** Delete raw events older than `days` (default: the site's retention) right now. */
export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'admin')
  const raw = event.node.req.headers['content-length'] === '0' ? {} : await readJsonBody(event, 1024).catch(() => ({}))
  const body = parseWith(bodySchema, raw)
  const days = body.days ?? effectiveRetentionDays(site)
  if (!days)
    throw createError({ statusCode: 400, statusMessage: 'No retention configured; pass { "days": n }' })
  const row = useSqlite().prepare('SELECT id, timezone, retention_days, pruned_before FROM websites WHERE id = ?').get(site.id) as Parameters<typeof pruneSite>[0]
  return { days, ...pruneSite(row, days) }
})
