import { escapeLike } from '../http'

/** Public filter name → events column. */
const COLS = {
  path: 'path',
  referrer: 'referrer_host',
  channel: 'channel',
  utm_source: 'utm_source',
  utm_medium: 'utm_medium',
  utm_campaign: 'utm_campaign',
  country: 'country',
  browser: 'browser',
  os: 'os',
  device: 'device',
  language: 'language',
  event: 'name',
} as const

export type FilterKey = keyof typeof COLS
export type Filters = Partial<Record<FilterKey, string>>
export const FILTER_KEYS = Object.keys(COLS) as FilterKey[]

/** Pull whitelisted filters out of a query/object; ignores anything else. */
export function parseFilters(q: Record<string, unknown>): Filters {
  const out: Filters = {}
  for (const k of FILTER_KEYS) {
    const v = q[k]
    if (typeof v === 'string' && v.trim())
      out[k] = v.trim().slice(0, 256)
  }
  return out
}

export function hasFilters(f: Filters) {
  return FILTER_KEYS.some(k => !!f[k])
}

/** " AND col = ? …" (column names come from the whitelist above, values are bound). */
export function filterSql(f: Filters) {
  let sql = ''
  const args: Array<string> = []
  for (const k of FILTER_KEYS) {
    const v = f[k]
    if (!v)
      continue
    if (k === 'path' && v.endsWith('*')) {
      sql += ` AND path LIKE ? ESCAPE '\\'`
      args.push(`${escapeLike(v.slice(0, -1))}%`)
    }
    else {
      sql += ` AND ${COLS[k]} = ?`
      args.push(v)
    }
  }
  return { sql, args }
}

export type BreakdownBy = Exclude<FilterKey, never>

export function columnOf(by: FilterKey) {
  return COLS[by]
}
