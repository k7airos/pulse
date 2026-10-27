import { intParam } from '../http'
import { compareRange, resolveRange } from '../siteRequest'
import type { CompareMode, SiteRow } from '../siteRequest'
import { getBreakdown, getTimeseries, getTotals } from './events'
import { FILTER_KEYS, parseFilters } from './filters'
import type { FilterKey } from './filters'
import { runFunnel, listFunnels } from './funnels'
import { goalStats, listGoals } from './goals'
import { pctChange } from './overview'

type Query = Record<string, unknown>

function compareMode(q: Query): CompareMode | null {
  return q.compare === 'prev' || q.compare === 'year' ? q.compare : null
}

/** Everything the report page needs in one call; every part honours the same filters. */
export function buildReport(site: SiteRow, q: Query) {
  const { startDay, endDay, tz } = resolveRange(site, q)
  const filters = parseFilters(q)
  const totals = getTotals(site.id, startDay, endDay, filters)
  const series = getTimeseries(site.id, startDay, endDay, filters)

  let compare = null
  const mode = compareMode(q)
  if (mode) {
    const r = compareRange(startDay, endDay, mode)
    const t = getTotals(site.id, r.startDay, r.endDay, filters)
    compare = {
      mode,
      ...r,
      totals: t,
      series: getTimeseries(site.id, r.startDay, r.endDay, filters),
      change: {
        pageviews: pctChange(totals.pageviews, t.pageviews),
        events: pctChange(totals.events, t.events),
        visitors: pctChange(totals.visitors, t.visitors),
      },
    }
  }

  const panels = Object.fromEntries(
    (['path', 'event', 'referrer', 'channel'] as const).map(by => [by, getBreakdown(site.id, by, startDay, endDay, filters, 10)]),
  )

  const goals = listGoals(site.id).map(g => ({
    ...g,
    ...goalStats(site.id, g, startDay, endDay, filters, totals.visitors),
  }))

  return {
    website: { id: site.id, name: site.name, domain: site.domain, timezone: site.timezone, tz },
    range: { startDay, endDay, tz },
    filters,
    totals,
    series,
    compare,
    panels,
    goals,
  }
}

export function buildBreakdown(site: SiteRow, q: Query) {
  const by = String(q.by || '') as FilterKey
  if (!FILTER_KEYS.includes(by))
    throw createError({ statusCode: 400, statusMessage: `by must be one of ${FILTER_KEYS.join('|')}` })
  const { startDay, endDay } = resolveRange(site, q)
  const rows = getBreakdown(site.id, by, startDay, endDay, parseFilters(q), intParam(q.limit, 10, 1, 100))
  return { by, startDay, endDay, rows }
}

export function buildFunnels(site: SiteRow, q: Query) {
  const { startDay, endDay } = resolveRange(site, q)
  const filters = parseFilters(q)
  return {
    startDay,
    endDay,
    funnels: listFunnels(site.id).map(f => ({ ...f, result: runFunnel(site.id, f, startDay, endDay, filters) })),
  }
}
