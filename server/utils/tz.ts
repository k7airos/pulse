/**
 * Timezone helpers. Everything is IANA-name based; a site without an explicit
 * timezone uses the server's own zone, so behaviour is unchanged for existing sites.
 */

export const SERVER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const fmtCache = new Map<string, Intl.DateTimeFormat>()

function fmt(tz: string) {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    fmtCache.set(tz, f)
  }
  return f
}

export function isValidTz(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64)
    return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  }
  catch {
    return false
  }
}

export function siteTz(site: { timezone?: string | null }) {
  return site.timezone && isValidTz(site.timezone) ? site.timezone : SERVER_TZ
}

function parts(ts: number, tz: string) {
  const o: Record<string, number> = {}
  for (const p of fmt(tz).formatToParts(new Date(ts))) {
    if (p.type !== 'literal')
      o[p.type] = Number(p.value)
  }
  return o as { year: number, month: number, day: number, hour: number, minute: number, second: number }
}

/** "YYYY-MM-DD" of `ts` in `tz`. */
export function tzDayKey(ts: number, tz: string) {
  const p = parts(ts, tz)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** tz offset (ms, local = utc + offset) at instant `ts`. */
function offsetAt(ts: number, tz: string) {
  const p = parts(ts, tz)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000
}

/** UTC ms of local midnight for a "YYYY-MM-DD" key in `tz`. */
export function startOfDayKey(key: string, tz: string) {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  const utcMid = Date.UTC(y, m - 1, d)
  let t = utcMid - offsetAt(utcMid, tz)
  const off2 = offsetAt(t, tz)
  if (utcMid - off2 !== t)
    t = utcMid - off2
  return t
}

export function addDays(key: string, n: number) {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** Inclusive list of day keys. */
export function dayKeysBetween(startDay: string, endDay: string) {
  const out: string[] = []
  let k = startDay
  for (let i = 0; i < 800 && k <= endDay; i++) {
    out.push(k)
    k = addDays(k, 1)
  }
  return out
}

/** Whole days between two keys (end - start). */
export function diffDays(startDay: string, endDay: string) {
  const [y1, m1, d1] = startDay.split('-').map(Number) as [number, number, number]
  const [y2, m2, d2] = endDay.split('-').map(Number) as [number, number, number]
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}
