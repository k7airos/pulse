import { classifyChannel, hostOf, isSelfHost, parseUtm } from '../enrich'
import type { Env } from '../enrich'
import { useSqlite } from '../db'
import { escapeLike } from '../http'
import { newId } from '../ids'
import { dayKeysBetween, siteTz, tzDayKey } from '../tz'
import { columnOf, filterSql, hasFilters } from './filters'
import type { FilterKey, Filters } from './filters'

export interface CollectInput {
  website: { id: string, domain: string | null, timezone: string | null }
  type: 'pageview' | 'event'
  name?: string | null
  path?: string | null
  url?: string | null
  referrer?: string | null
  props?: Record<string, string | number | boolean> | null
  sessionId?: string | null
  visitorId?: string | null
  /** Honoured only when plausible (see clampTs). Anonymous browser collect never passes it. */
  ts?: number | null
  /** Derived from the request (UA / geo); never raw IP or UA. */
  env?: Partial<Env> & { country?: string | null, language?: string | null }
}

export interface StatTotals {
  pageviews: number
  events: number
  visitors: number
}

const MAX_PROPS_JSON = 4096
const MAX_PROPS_KEYS = 20
const DAY_MS = 24 * 60 * 60 * 1000
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** Reject forged timestamps: only accept roughly "now" ± a year back / 5 min ahead. */
function clampTs(ts: number | null | undefined, now: number) {
  if (typeof ts !== 'number' || !Number.isFinite(ts))
    return now
  if (ts > now + 5 * 60_000 || ts < now - 366 * DAY_MS)
    return now
  return Math.trunc(ts)
}

/** Strip query + hash: they fragment aggregates and can carry tokens/PII. */
export function normalizePath(p: string | null | undefined) {
  const raw = (p || '').trim()
  const cut = raw.split('#')[0]!.split('?')[0]!
  if (!cut)
    return ''
  return (cut.startsWith('/') ? cut : `/${cut}`).slice(0, 512)
}

function stripHash(u: string | null | undefined, dropQuery = false) {
  let s = (u || '').trim().split('#')[0]!
  if (dropQuery)
    s = s.split('?')[0]!
  return s.slice(0, 1024) || null
}

function sanitizeProps(props: CollectInput['props']) {
  if (!props || typeof props !== 'object')
    return null
  const out: Record<string, string | number | boolean> = {}
  let n = 0
  for (const [k, v] of Object.entries(props)) {
    if (n >= MAX_PROPS_KEYS)
      break
    if (typeof k !== 'string' || !k || k.length > 64 || FORBIDDEN_KEYS.has(k))
      continue
    if (typeof v === 'string' && v.length <= 512)
      out[k] = v
    else if (typeof v === 'number' && Number.isFinite(v))
      out[k] = v
    else if (typeof v === 'boolean')
      out[k] = v
    else
      continue
    n++
  }
  // Never truncate JSON mid-string (it would become unparseable): drop keys instead.
  const keys = Object.keys(out)
  while (keys.length && JSON.stringify(out).length > MAX_PROPS_JSON)
    delete out[keys.pop()!]
  return keys.length ? JSON.stringify(out) : null
}

type Sqlite = ReturnType<typeof useSqlite>

function bumpAggregate(sqlite: Sqlite, opts: {
  websiteId: string
  day: string
  path: string
  eventName: string
  isPageview: boolean
  visitorId: string | null
}) {
  const { websiteId, day, path, eventName, isPageview, visitorId } = opts

  let newVisitor = 0
  if (visitorId) {
    const r = sqlite.prepare(`
      INSERT OR IGNORE INTO daily_visitors (id, website_id, day, path, event_name, visitor_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(newId('dv'), websiteId, day, path, eventName, visitorId)
    newVisitor = r.changes > 0 ? 1 : 0
  }

  sqlite.prepare(`
    INSERT INTO daily_stats (id, website_id, day, path, event_name, pageviews, events, visitors)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(website_id, day, path, event_name) DO UPDATE SET
      pageviews = pageviews + excluded.pageviews,
      events = events + excluded.events,
      visitors = visitors + excluded.visitors
  `).run(newId('ds'), websiteId, day, path, eventName, isPageview ? 1 : 0, isPageview ? 0 : 1, newVisitor)
}

interface Attribution {
  referrer_host: string | null
  channel: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
}

/** Traffic source of a single hit (before session inheritance). */
function attributionOf(url: string | null, referrer: string | null, domain: string | null): Attribution {
  const utm = parseUtm(url)
  let host = hostOf(referrer)
  const internal = isSelfHost(host, domain)
  if (internal)
    host = ''
  const hasUtm = !!(utm.utm_source || utm.utm_medium || utm.utm_campaign)
  return {
    referrer_host: host || null,
    channel: internal && !hasUtm ? null : classifyChannel(utm, host),
    ...utm,
  }
}

/** Insert the raw row and all rollups atomically. */
export async function ingestEvent(input: CollectInput) {
  const sqlite = useSqlite()
  const site = input.website
  const now = Date.now()
  const ts = clampTs(input.ts, now)
  const type = input.type
  const name = type === 'event' ? (input.name || 'unknown') : null
  const path = normalizePath(input.path)
  const url = stripHash(input.url)
  const referrer = stripHash(input.referrer, true)
  const props = sanitizeProps(input.props)
  const sessionId = input.sessionId?.slice(0, 64) || null
  const visitorId = input.visitorId?.slice(0, 64) || null
  const id = newId('ev')
  const day = tzDayKey(ts, siteTz(site))
  const isPageview = type === 'pageview'
  const env = input.env || {}

  const run = sqlite.transaction(() => {
    // Every hit of a session inherits the session's first hit as its traffic source,
    // so events and goals can be filtered by channel/UTM like pageviews.
    let attr: Attribution | undefined
    if (sessionId) {
      attr = sqlite.prepare(`
        SELECT referrer_host, channel, utm_source, utm_medium, utm_campaign, utm_term, utm_content
        FROM events WHERE website_id = ? AND session_id = ? ORDER BY ts ASC LIMIT 1
      `).get(site.id, sessionId) as Attribution | undefined
    }
    attr ||= attributionOf(url, referrer, site.domain)

    sqlite.prepare(`
      INSERT INTO events (
        id, website_id, type, name, path, url, referrer, props, session_id, visitor_id, ts, day,
        referrer_host, channel, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        country, browser, os, device, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, site.id, type, name, path || null, url, referrer, props, sessionId, visitorId, ts, day,
      attr.referrer_host, attr.channel, attr.utm_source, attr.utm_medium, attr.utm_campaign, attr.utm_term, attr.utm_content,
      env.country || null, env.browser || null, env.os || null, env.device || null, env.language || null,
    )

    const base = { websiteId: site.id, day, isPageview, visitorId }
    if (isPageview) {
      bumpAggregate(sqlite, { ...base, path: '', eventName: '' })
      if (path)
        bumpAggregate(sqlite, { ...base, path, eventName: '' })
    }
    else {
      const en = name || 'unknown'
      bumpAggregate(sqlite, { ...base, path: '', eventName: '' })
      bumpAggregate(sqlite, { ...base, path: '', eventName: en })
      if (path)
        bumpAggregate(sqlite, { ...base, path, eventName: en })
    }
  })
  run()

  return { id, ts }
}

function placeholders(n: number) {
  return new Array(n).fill('?').join(',')
}

/**
 * Site-wide totals for many sites in two grouped queries (unfiltered fast path).
 * `visitors` is a true distinct count over the whole range, not a sum of daily uniques.
 */
export function getStatsForSites(siteIds: string[], startDay: string, endDay: string) {
  const out = new Map<string, StatTotals>()
  for (const id of siteIds)
    out.set(id, { pageviews: 0, events: 0, visitors: 0 })
  if (!siteIds.length)
    return out

  const sqlite = useSqlite()
  const ph = placeholders(siteIds.length)

  const sums = sqlite.prepare(`
    SELECT website_id AS id, SUM(pageviews) AS pv, SUM(events) AS ev
    FROM daily_stats
    WHERE website_id IN (${ph}) AND path = '' AND event_name = '' AND day BETWEEN ? AND ?
    GROUP BY website_id
  `).all(...siteIds, startDay, endDay) as Array<{ id: string, pv: number, ev: number }>
  for (const r of sums) {
    const t = out.get(r.id)!
    t.pageviews = Number(r.pv || 0)
    t.events = Number(r.ev || 0)
  }

  const uvs = sqlite.prepare(`
    SELECT website_id AS id, COUNT(DISTINCT visitor_id) AS uv
    FROM daily_visitors
    WHERE website_id IN (${ph}) AND path = '' AND event_name = '' AND day BETWEEN ? AND ?
    GROUP BY website_id
  `).all(...siteIds, startDay, endDay) as Array<{ id: string, uv: number }>
  for (const r of uvs)
    out.get(r.id)!.visitors = Number(r.uv || 0)

  return out
}

/** Totals for one site over a day range, optionally filtered (filtered → raw events). */
export function getTotals(siteId: string, startDay: string, endDay: string, filters: Filters = {}): StatTotals {
  if (!hasFilters(filters))
    return getStatsForSites([siteId], startDay, endDay).get(siteId)!
  const f = filterSql(filters)
  const r = useSqlite().prepare(`
    SELECT SUM(type = 'pageview') AS pv, SUM(type = 'event') AS ev, COUNT(DISTINCT visitor_id) AS uv
    FROM events WHERE website_id = ? AND day BETWEEN ? AND ?${f.sql}
  `).get(siteId, startDay, endDay, ...f.args) as { pv: number | null, ev: number | null, uv: number }
  return { pageviews: Number(r.pv || 0), events: Number(r.ev || 0), visitors: Number(r.uv || 0) }
}

export interface SeriesPoint {
  day: string
  pageviews: number
  events: number
  visitors: number
}

/** Daily series (zero-filled). Visitors are per-day uniques. */
export function getTimeseries(siteId: string, startDay: string, endDay: string, filters: Filters = {}): SeriesPoint[] {
  const sqlite = useSqlite()
  const days = dayKeysBetween(startDay, endDay)
  let rows: SeriesPoint[]
  if (!hasFilters(filters)) {
    rows = sqlite.prepare(`
      SELECT day, pageviews, events, visitors
      FROM daily_stats
      WHERE website_id = ? AND path = '' AND event_name = '' AND day BETWEEN ? AND ?
    `).all(siteId, startDay, endDay) as SeriesPoint[]
  }
  else {
    const f = filterSql(filters)
    rows = sqlite.prepare(`
      SELECT day, SUM(type = 'pageview') AS pageviews, SUM(type = 'event') AS events, COUNT(DISTINCT visitor_id) AS visitors
      FROM events WHERE website_id = ? AND day BETWEEN ? AND ?${f.sql}
      GROUP BY day
    `).all(siteId, startDay, endDay, ...f.args) as SeriesPoint[]
  }
  const byDay = new Map(rows.map(r => [r.day, r]))
  return days.map((day) => {
    const r = byDay.get(day)
    return {
      day,
      pageviews: Number(r?.pageviews || 0),
      events: Number(r?.events || 0),
      visitors: Number(r?.visitors || 0),
    }
  })
}

/** Site-wide daily pageviews for many sites at once (sparklines). */
export function getDailyPageviewsForSites(siteIds: string[], startDay: string, endDay: string) {
  const days = dayKeysBetween(startDay, endDay)
  const out = new Map<string, number[]>()
  for (const id of siteIds)
    out.set(id, new Array(days.length).fill(0))
  if (!siteIds.length)
    return { days, series: out }

  const idx = new Map(days.map((d, i) => [d, i]))
  const rows = useSqlite().prepare(`
    SELECT website_id AS id, day, pageviews
    FROM daily_stats
    WHERE website_id IN (${placeholders(siteIds.length)}) AND path = '' AND event_name = '' AND day BETWEEN ? AND ?
  `).all(...siteIds, startDay, endDay) as Array<{ id: string, day: string, pageviews: number }>
  for (const r of rows) {
    const i = idx.get(r.day)
    if (i !== undefined)
      out.get(r.id)![i] = Number(r.pageviews || 0)
  }
  return { days, series: out }
}

/** Distinct visitors seen in the last `minutes` per site ("online now"). */
export function getActiveVisitors(siteIds: string[], minutes = 5) {
  const out = new Map<string, number>()
  for (const id of siteIds)
    out.set(id, 0)
  if (!siteIds.length)
    return out
  const since = Date.now() - minutes * 60_000
  const rows = useSqlite().prepare(`
    SELECT website_id AS id, COUNT(DISTINCT visitor_id) AS n
    FROM events
    WHERE website_id IN (${placeholders(siteIds.length)}) AND ts >= ? AND visitor_id IS NOT NULL
    GROUP BY website_id
  `).all(...siteIds, since) as Array<{ id: string, n: number }>
  for (const r of rows)
    out.set(r.id, Number(r.n || 0))
  return out
}

export interface BreakdownRow {
  x: string
  /** pageviews for every dimension except `event` (event occurrences). */
  count: number
  visitors: number
}

/**
 * Top values of one dimension. `path` and `event` use the daily rollups when
 * unfiltered; everything else (and any filtered query) reads raw events.
 */
export function getBreakdown(
  siteId: string,
  by: FilterKey,
  startDay: string,
  endDay: string,
  filters: Filters = {},
  limit = 10,
): BreakdownRow[] {
  const sqlite = useSqlite()
  // A filter on the dimension itself would collapse the list to one row; ignore it here.
  const f = filterSql({ ...filters, [by]: undefined })
  const unfiltered = !f.sql

  if (unfiltered && (by === 'path' || by === 'event')) {
    if (by === 'path') {
      const rows = sqlite.prepare(`
        SELECT path AS x, SUM(pageviews) AS c
        FROM daily_stats
        WHERE website_id = ? AND path != '' AND event_name = '' AND day BETWEEN ? AND ?
        GROUP BY path ORDER BY c DESC LIMIT ?
      `).all(siteId, startDay, endDay, limit) as Array<{ x: string, c: number }>
      const uv = distinctVisitors(sqlite, 'path', siteId, rows.map(r => r.x), startDay, endDay)
      return rows.map(r => ({ x: r.x, count: Number(r.c || 0), visitors: uv.get(r.x) || 0 }))
    }
    const rows = sqlite.prepare(`
      SELECT event_name AS x, SUM(events) AS c
      FROM daily_stats
      WHERE website_id = ? AND path = '' AND event_name != '' AND day BETWEEN ? AND ?
      GROUP BY event_name ORDER BY c DESC LIMIT ?
    `).all(siteId, startDay, endDay, limit) as Array<{ x: string, c: number }>
    const uv = distinctVisitors(sqlite, 'event_name', siteId, rows.map(r => r.x), startDay, endDay)
    return rows.map(r => ({ x: r.x, count: Number(r.c || 0), visitors: uv.get(r.x) || 0 }))
  }

  const col = columnOf(by)
  // Filtering by an event name means "look at those events" for every dimension.
  const type = by === 'event' || filters.event ? 'event' : 'pageview'
  const rows = sqlite.prepare(`
    SELECT ${col} AS x, COUNT(*) AS c, COUNT(DISTINCT visitor_id) AS uv
    FROM events
    WHERE website_id = ? AND type = ? AND day BETWEEN ? AND ? AND ${col} IS NOT NULL AND ${col} != ''${f.sql}
    GROUP BY ${col} ORDER BY c DESC LIMIT ?
  `).all(siteId, type, startDay, endDay, ...f.args, limit) as Array<{ x: string, c: number, uv: number }>
  return rows.map(r => ({ x: r.x, count: Number(r.c || 0), visitors: Number(r.uv || 0) }))
}

function distinctVisitors(
  sqlite: Sqlite,
  col: 'path' | 'event_name',
  siteId: string,
  keys: string[],
  startDay: string,
  endDay: string,
) {
  const out = new Map<string, number>()
  if (!keys.length)
    return out
  const cond = col === 'path'
    ? `event_name = '' AND path IN (${placeholders(keys.length)})`
    : `path = '' AND event_name IN (${placeholders(keys.length)})`
  const rows = sqlite.prepare(`
    SELECT ${col} AS k, COUNT(DISTINCT visitor_id) AS n
    FROM daily_visitors
    WHERE website_id = ? AND ${cond} AND day BETWEEN ? AND ?
    GROUP BY ${col}
  `).all(siteId, ...keys, startDay, endDay) as Array<{ k: string, n: number }>
  for (const r of rows)
    out.set(r.k, Number(r.n || 0))
  return out
}

export async function getInterest(opts: {
  websiteId: string
  pathPrefix?: string
  eventName?: string
  days: number
}) {
  const end = Date.now()
  const start = end - opts.days * DAY_MS
  const sqlite = useSqlite()

  if (opts.eventName) {
    const r = sqlite.prepare(`
      SELECT COUNT(*) AS hits, COUNT(DISTINCT visitor_id) AS uv
      FROM events
      WHERE website_id = ? AND type = 'event' AND name = ? AND ts BETWEEN ? AND ?
    `).get(opts.websiteId, opts.eventName, start, end) as { hits: number, uv: number }
    return {
      count: Number(r.uv || r.hits || 0),
      hits: Number(r.hits || 0),
      windowDays: opts.days,
      by: 'event' as const,
      eventName: opts.eventName,
    }
  }

  const prefix = opts.pathPrefix || '/'
  const r = sqlite.prepare(`
    SELECT COUNT(*) AS hits, COUNT(DISTINCT visitor_id) AS uv
    FROM events
    WHERE website_id = ? AND type = 'pageview' AND path LIKE ? ESCAPE '\\' AND ts BETWEEN ? AND ?
  `).get(opts.websiteId, `${escapeLike(prefix)}%`, start, end) as { hits: number, uv: number }

  return {
    count: Number(r.uv || r.hits || 0),
    hits: Number(r.hits || 0),
    windowDays: opts.days,
    by: 'path' as const,
    pathPrefix: prefix,
  }
}

function safeJson(raw: string | null) {
  if (!raw)
    return null
  try {
    return JSON.parse(raw)
  }
  catch {
    return null
  }
}

export async function listEvents(opts: {
  websiteId: string
  name?: string
  pathPrefix?: string
  startAt: number
  endAt: number
  limit?: number
}) {
  const sqlite = useSqlite()
  // A negative LIMIT means "no limit" in SQLite — always clamp.
  const limit = Math.min(Math.max(Math.trunc(opts.limit || 50), 1), 200)
  const where = ['website_id = ?', 'ts BETWEEN ? AND ?']
  const args: Array<string | number> = [opts.websiteId, opts.startAt, opts.endAt]
  if (opts.name) {
    where.push('name = ?')
    args.push(opts.name)
  }
  if (opts.pathPrefix) {
    where.push(`path LIKE ? ESCAPE '\\'`)
    args.push(`${escapeLike(opts.pathPrefix)}%`)
  }

  const rows = sqlite.prepare(`
    SELECT id, type, name, path, url, referrer, props, session_id AS sessionId, visitor_id AS visitorId, ts,
      channel, utm_source AS utmSource, utm_medium AS utmMedium, utm_campaign AS utmCampaign,
      country, browser, os, device
    FROM events
    WHERE ${where.join(' AND ')}
    ORDER BY ts DESC
    LIMIT ?
  `).all(...args, limit) as Array<Record<string, string | number | null>>

  return rows.map(({ props, ...r }) => ({ ...r, props: safeJson(props as string | null) }))
}

