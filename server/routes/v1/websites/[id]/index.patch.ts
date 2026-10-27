import { z } from 'zod'
import { useSqlite } from '../../../../utils/db'
import { parseWith, readJsonBody } from '../../../../utils/http'
import { loadSite } from '../../../../utils/siteRequest'
import { rebuildAggregates } from '../../../../utils/store/maintenance'
import { isValidTz, siteTz } from '../../../../utils/tz'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  domain: z.string().trim().max(256).nullable().optional(),
  /** IANA name, or null for the server's zone. */
  timezone: z.string().nullable().optional(),
  /** Keep raw events this many days; 0 = forever; null = server default (PULSE_RETENTION_DAYS). */
  retentionDays: z.number().int().min(0).max(3650).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'admin')
  const body = parseWith(bodySchema, await readJsonBody(event, 4 * 1024))
  if (body.timezone && !isValidTz(body.timezone))
    throw createError({ statusCode: 400, statusMessage: 'Invalid timezone (IANA name expected)' })

  const sqlite = useSqlite()
  const oldTz = siteTz(site)
  const next = {
    name: body.name ?? site.name,
    domain: body.domain === undefined ? site.domain : (body.domain || null),
    timezone: body.timezone === undefined ? site.timezone : (body.timezone || null),
    retentionDays: body.retentionDays === undefined ? site.retentionDays : body.retentionDays,
  }
  sqlite.prepare('UPDATE websites SET name = ?, domain = ?, timezone = ?, retention_days = ? WHERE id = ?')
    .run(next.name, next.domain, next.timezone, next.retentionDays, site.id)

  const newTz = siteTz(next)
  if (newTz !== oldTz)
    rebuildAggregates(site.id, oldTz, newTz)

  return { website: { ...site, ...next }, timezoneChanged: newTz !== oldTz }
})
