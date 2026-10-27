import type { H3Event } from 'h3'
import { assertWebsiteAccess, requireAuth, resolveWebsiteById } from './auth/apiKey'
import type { Scope } from './auth/apiKey'
import { useSqlite } from './db'
import { clientIp, rangeParams } from './http'
import { rateLimit } from './rateLimit'
import { addDays, diffDays, siteTz, tzDayKey } from './tz'

export type SiteRow = NonNullable<Awaited<ReturnType<typeof resolveWebsiteById>>>

/** Auth + site lookup shared by every /v1/websites/:id/* route. */
export async function loadSite(event: H3Event, scope: Scope): Promise<SiteRow> {
  const auth = await requireAuth(event as never, scope)
  const id = getRouterParam(event, 'id')!
  assertWebsiteAccess(auth, id)
  const site = await resolveWebsiteById(id)
  if (!site)
    throw createError({ statusCode: 404, statusMessage: 'Website not found' })
  return site
}

/** Public read-only access through a share link (no API key). */
export function loadSharedSite(event: H3Event): SiteRow {
  if (!rateLimit(`share:${clientIp(event)}`, 120, 60_000))
    throw createError({ statusCode: 429, statusMessage: 'Rate limit' })
  const shareId = getRouterParam(event, 'shareId') || ''
  const row = shareId.length >= 16 && shareId.length <= 64
    ? useSqlite().prepare('SELECT id FROM websites WHERE share_id = ?').get(shareId) as { id: string } | undefined
    : undefined
  if (!row)
    throw createError({ statusCode: 404, statusMessage: 'Share link not found' })
  const site = useSqlite().prepare(`
    SELECT id, name, domain, public_id AS publicId, created_at AS createdAt, timezone,
      share_id AS shareId, retention_days AS retentionDays, pruned_before AS prunedBefore
    FROM websites WHERE id = ?
  `).get(row.id) as SiteRow
  return site
}

const DAY_RE = /^(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function validDay(v: unknown): v is string {
  return typeof v === 'string' && DAY_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
}

/**
 * Inclusive day range in the site's timezone.
 * `startDay`/`endDay` (YYYY-MM-DD) win, then `days` (last N days); otherwise `startAt`/`endAt` (ms).
 */
export function resolveRange(site: { timezone?: string | null }, q: Record<string, unknown>, defaultDays = 7) {
  const tz = siteTz(site)
  let startDay: string
  let endDay: string
  const n = Number(q.days)
  if (validDay(q.startDay) && validDay(q.endDay)) {
    startDay = q.startDay
    endDay = q.endDay
  }
  else if (Number.isInteger(n) && n >= 1 && n <= 366) {
    // "last N calendar days including today" in the site's timezone
    endDay = tzDayKey(Date.now(), tz)
    startDay = addDays(endDay, -(n - 1))
  }
  else {
    const r = rangeParams(q, defaultDays)
    startDay = tzDayKey(r.startAt, tz)
    endDay = tzDayKey(r.endAt, tz)
  }
  if (endDay < startDay)
    [startDay, endDay] = [endDay, startDay]
  if (diffDays(startDay, endDay) > 365)
    startDay = addDays(endDay, -365)
  return { startDay, endDay, tz }
}

function shiftYear(key: string, delta: number) {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y + delta, m - 1, d))
  if (dt.getUTCMonth() !== m - 1) // Feb 29 → Feb 28
    dt.setUTCDate(0)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

export type CompareMode = 'prev' | 'year'

export function compareRange(startDay: string, endDay: string, mode: CompareMode) {
  if (mode === 'year')
    return { startDay: shiftYear(startDay, -1), endDay: shiftYear(endDay, -1) }
  const len = diffDays(startDay, endDay) + 1
  const end = addDays(startDay, -1)
  return { startDay: addDays(end, -(len - 1)), endDay: end }
}
