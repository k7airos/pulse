import type { WindowKey, WindowOverview } from '../../../app/types/overview'
import { addDays, siteTz, startOfDayKey, tzDayKey } from '../tz'
import { getActiveVisitors, getDailyPageviewsForSites, getStatsForSites } from './events'

export type { WindowKey, WindowOverview, StatBlock } from '../../../app/types/overview'

/**
 * Calendar-day windows in the site's timezone (not rolling 24h).
 *
 * - current: from local midnight of (today − (days−1)) through `now`
 * - previous: the immediately preceding full span of the same day count
 */
export function calendarWindow(days: number, now: number, tz: string) {
  const today = tzDayKey(now, tz)
  const curStartDay = addDays(today, -(days - 1))
  const prevEndDay = addDays(curStartDay, -1)
  const prevStartDay = addDays(curStartDay, -days)
  const currentStart = startOfDayKey(curStartDay, tz)
  return {
    curStartDay,
    curEndDay: today,
    prevStartDay,
    prevEndDay,
    currentStart,
    currentEnd: now,
    previousStart: startOfDayKey(prevStartDay, tz),
    previousEnd: currentStart - 1,
  }
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0)
    return 0
  if (previous === 0)
    return current > 0 ? null : 0 // null = "new / 无基线"
  return (current - previous) / previous
}

/**
 * Stable English labels for API consumers.
 * Admin UI ignores these and translates via period.* i18n keys on `key`.
 */
const WINDOWS: Array<{ key: WindowKey, label: string, compareLabel: string, days: number }> = [
  { key: 'd1', label: 'Last 1 day', compareLabel: 'vs yesterday', days: 1 },
  { key: 'd7', label: 'Last 7 days', compareLabel: 'vs prior 7 days', days: 7 },
  { key: 'd30', label: 'Last 30 days', compareLabel: 'vs prior 30 days', days: 30 },
]

const SPARK_DAYS = 14

interface SiteLike { id: string, timezone?: string | null }

/**
 * Overview for many sites in a fixed number of queries per timezone (no N+1):
 * 3 windows × (current, previous) grouped stats, one sparkline query, one "online now" query.
 */
export function getOverviewForSites(sites: SiteLike[], now = Date.now()) {
  const byTz = new Map<string, string[]>()
  for (const s of sites) {
    const tz = siteTz(s)
    byTz.set(tz, [...(byTz.get(tz) || []), s.id])
  }

  const result = new Map<string, { windows: WindowOverview[], sparkline: number[] }>()
  for (const [tz, ids] of byTz) {
    const perWindow = WINDOWS.map((w) => {
      const c = calendarWindow(w.days, now, tz)
      return {
        w,
        c,
        current: getStatsForSites(ids, c.curStartDay, c.curEndDay),
        previous: getStatsForSites(ids, c.prevStartDay, c.prevEndDay),
      }
    })
    const today = tzDayKey(now, tz)
    const spark = getDailyPageviewsForSites(ids, addDays(today, -(SPARK_DAYS - 1)), today)

    for (const id of ids) {
      const windows: WindowOverview[] = perWindow.map(({ w, c, current, previous }) => {
        const cur = current.get(id)!
        const prev = previous.get(id)!
        return {
          key: w.key,
          label: w.label,
          compareLabel: w.compareLabel,
          days: w.days,
          current: { ...cur, startAt: c.currentStart, endAt: c.currentEnd },
          previous: { ...prev, startAt: c.previousStart, endAt: c.previousEnd },
          change: {
            pageviews: pctChange(cur.pageviews, prev.pageviews),
            events: pctChange(cur.events, prev.events),
            visitors: pctChange(cur.visitors, prev.visitors),
          },
        }
      })
      result.set(id, { windows, sparkline: spark.series.get(id) || [] })
    }
  }

  const active = getActiveVisitors(sites.map(s => s.id), 5)
  return sites.map(s => ({
    websiteId: s.id,
    ...result.get(s.id)!,
    active: active.get(s.id) || 0,
  }))
}

export function getWebsiteOverview(site: SiteLike, now = Date.now()) {
  const o = getOverviewForSites([site], now)[0]!
  return { windows: o.windows, now }
}
