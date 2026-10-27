import { useSqlite } from '../db'
import { addDays, siteTz, startOfDayKey, tzDayKey } from '../tz'

const DAY_MS = 24 * 60 * 60 * 1000
const BATCH = 20_000

interface SiteRow {
  id: string
  timezone: string | null
  retention_days: number | null
  pruned_before: number | null
}

/** Global default retention in days (0 / unset = keep forever). */
export function defaultRetentionDays() {
  const n = Number(process.env.PULSE_RETENTION_DAYS || 0)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function effectiveRetentionDays(site: { retention_days?: number | null, retentionDays?: number | null }) {
  const own = site.retention_days ?? site.retentionDays
  return own === null || own === undefined ? defaultRetentionDays() : own
}

/**
 * Re-bucket a site's history into a new timezone: events.day is recomputed and the
 * daily rollups rebuilt from raw events. If old raw events were already pruned, rollup
 * rows before the first fully retained day are left as they were.
 */
export function rebuildAggregates(siteId: string, oldTz: string, newTz: string) {
  const sqlite = useSqlite()
  const site = sqlite.prepare('SELECT pruned_before FROM websites WHERE id = ?').get(siteId) as { pruned_before: number | null } | undefined
  const prunedBefore = site?.pruned_before || 0
  const startTs = prunedBefore ? startOfDayKey(addDays(tzDayKey(prunedBefore, oldTz), 1), oldTz) : 0
  const keepBelowDay = prunedBefore ? tzDayKey(startTs, oldTz) : ''

  const tx = sqlite.transaction(() => {
    sqlite.prepare('UPDATE events SET day = pulse_day(ts, ?) WHERE website_id = ?').run(newTz, siteId)
    sqlite.prepare('DELETE FROM daily_stats WHERE website_id = ? AND day >= ?').run(siteId, keepBelowDay)
    sqlite.prepare('DELETE FROM daily_visitors WHERE website_id = ? AND day >= ?').run(siteId, keepBelowDay)

    const upsert = (selectCols: string, where: string, group: string) => sqlite.prepare(`
      INSERT INTO daily_stats (id, website_id, day, path, event_name, pageviews, events, visitors)
      SELECT lower(hex(randomblob(8))), website_id, day, ${selectCols}
      FROM events WHERE website_id = ? AND ts >= ? ${where}
      GROUP BY ${group}
      ON CONFLICT(website_id, day, path, event_name) DO UPDATE SET
        pageviews = pageviews + excluded.pageviews,
        events = events + excluded.events,
        visitors = visitors + excluded.visitors
    `).run(siteId, startTs)

    upsert(`'', '', SUM(type = 'pageview'), SUM(type = 'event'), COUNT(DISTINCT visitor_id)`, '', 'day')
    upsert(`path, '', COUNT(*), 0, COUNT(DISTINCT visitor_id)`, `AND type = 'pageview' AND path IS NOT NULL`, 'day, path')
    upsert(`'', name, 0, COUNT(*), COUNT(DISTINCT visitor_id)`, `AND type = 'event' AND name IS NOT NULL`, 'day, name')
    upsert(`path, name, 0, COUNT(*), COUNT(DISTINCT visitor_id)`, `AND type = 'event' AND name IS NOT NULL AND path IS NOT NULL`, 'day, path, name')

    const vis = (selectCols: string, where: string, group: string) => sqlite.prepare(`
      INSERT OR IGNORE INTO daily_visitors (id, website_id, day, path, event_name, visitor_id)
      SELECT lower(hex(randomblob(8))), website_id, day, ${selectCols}, visitor_id
      FROM events WHERE website_id = ? AND ts >= ? AND visitor_id IS NOT NULL ${where}
      GROUP BY ${group}
    `).run(siteId, startTs)

    vis(`'', ''`, '', 'day, visitor_id')
    vis(`path, ''`, `AND type = 'pageview' AND path IS NOT NULL`, 'day, path, visitor_id')
    vis(`'', name`, `AND type = 'event' AND name IS NOT NULL`, 'day, name, visitor_id')
    vis(`path, name`, `AND type = 'event' AND name IS NOT NULL AND path IS NOT NULL`, 'day, path, name, visitor_id')
  })
  tx()
}

/** Delete raw events (and per-visitor rollup rows) older than `days`. Daily totals are kept. */
export function pruneSite(site: SiteRow, days: number, now = Date.now()) {
  if (!(days > 0))
    return { events: 0, visitors: 0, cutoff: 0 }
  const sqlite = useSqlite()
  const cutoff = now - days * DAY_MS
  const cutoffDay = tzDayKey(cutoff, siteTz({ timezone: site.timezone }))

  let events = 0
  let visitors = 0
  const delEvents = sqlite.prepare(`
    DELETE FROM events WHERE rowid IN (SELECT rowid FROM events WHERE website_id = ? AND ts < ? LIMIT ${BATCH})
  `)
  const delVisitors = sqlite.prepare(`
    DELETE FROM daily_visitors WHERE rowid IN (SELECT rowid FROM daily_visitors WHERE website_id = ? AND day < ? LIMIT ${BATCH})
  `)
  for (;;) {
    const n = delEvents.run(site.id, cutoff).changes
    events += n
    if (n < BATCH)
      break
  }
  for (;;) {
    const n = delVisitors.run(site.id, cutoffDay).changes
    visitors += n
    if (n < BATCH)
      break
  }
  if (events > 0) {
    sqlite.prepare('UPDATE websites SET pruned_before = MAX(COALESCE(pruned_before, 0), ?) WHERE id = ?').run(cutoff, site.id)
  }
  return { events, visitors, cutoff }
}

let running = false

/** Apply every site's retention policy; returns what was removed. */
export function pruneAll() {
  if (running)
    return []
  running = true
  try {
    const sqlite = useSqlite()
    const sites = sqlite.prepare('SELECT id, timezone, retention_days, pruned_before FROM websites').all() as SiteRow[]
    const out: Array<{ siteId: string, events: number, visitors: number }> = []
    for (const s of sites) {
      const days = effectiveRetentionDays(s)
      if (days > 0) {
        const r = pruneSite(s, days)
        if (r.events || r.visitors)
          out.push({ siteId: s.id, events: r.events, visitors: r.visitors })
      }
    }
    if (out.length)
      sqlite.pragma('wal_checkpoint(TRUNCATE)')
    return out
  }
  finally {
    running = false
  }
}

/** Remove a website and everything that belongs to it. */
export function deleteSite(siteId: string) {
  const sqlite = useSqlite()
  const tx = sqlite.transaction(() => {
    for (const t of ['events', 'daily_stats', 'daily_visitors', 'goals', 'funnels', 'api_keys'])
      sqlite.prepare(`DELETE FROM ${t} WHERE website_id = ?`).run(siteId)
    sqlite.prepare('DELETE FROM websites WHERE id = ?').run(siteId)
  })
  tx()
}
