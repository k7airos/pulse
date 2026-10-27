import { useSqlite } from '../db'
import { newId } from '../ids'
import { filterSql } from './filters'
import type { Filters } from './filters'
import { matchSql } from './goals'

export interface FunnelStep {
  type: 'path' | 'event'
  value: string
}

export interface Funnel {
  id: string
  name: string
  steps: FunnelStep[]
  windowMinutes: number
  createdAt: number
}

const MAX_ROWS = 300_000

function rowToFunnel(r: { id: string, name: string, steps: string, windowMinutes: number, createdAt: number }): Funnel {
  let steps: FunnelStep[] = []
  try {
    steps = JSON.parse(r.steps)
  }
  catch { /* corrupt row → no steps */ }
  return { id: r.id, name: r.name, steps, windowMinutes: r.windowMinutes, createdAt: r.createdAt }
}

export function listFunnels(siteId: string): Funnel[] {
  return (useSqlite().prepare(`
    SELECT id, name, steps, window_minutes AS windowMinutes, created_at AS createdAt
    FROM funnels WHERE website_id = ? ORDER BY created_at ASC
  `).all(siteId) as Parameters<typeof rowToFunnel>[0][]).map(rowToFunnel)
}

export function createFunnel(siteId: string, f: Pick<Funnel, 'name' | 'steps' | 'windowMinutes'>): Funnel {
  const funnel = { id: newId('fun'), ...f, createdAt: Date.now() }
  useSqlite().prepare(`
    INSERT INTO funnels (id, website_id, name, steps, window_minutes, created_at) VALUES (?, ?, ?, ?, ?, ?)
  `).run(funnel.id, siteId, funnel.name, JSON.stringify(funnel.steps), funnel.windowMinutes, funnel.createdAt)
  return funnel
}

export function deleteFunnel(siteId: string, id: string) {
  return useSqlite().prepare('DELETE FROM funnels WHERE id = ? AND website_id = ?').run(id, siteId).changes > 0
}

function stepMatches(step: FunnelStep, row: { type: string, name: string | null, path: string | null }) {
  if (step.type === 'event')
    return row.type === 'event' && row.name === step.value
  if (row.type !== 'pageview' || row.path === null)
    return false
  return step.value.endsWith('*') ? row.path.startsWith(step.value.slice(0, -1)) : row.path === step.value
}

/**
 * Visitors reaching each step in order, each step within `windowMinutes` of the previous one.
 * Reads at most MAX_ROWS matching hits; `truncated` says if the range had more.
 */
export function runFunnel(siteId: string, funnel: Funnel, startDay: string, endDay: string, filters: Filters) {
  const steps = funnel.steps
  const matchers = steps.map(s => matchSql(s.type, s.value))
  const f = filterSql(filters)
  const rows = useSqlite().prepare(`
    SELECT visitor_id AS v, type, name, path, ts
    FROM events
    WHERE website_id = ? AND day BETWEEN ? AND ? AND visitor_id IS NOT NULL
      AND (${matchers.map(m => m.sql).join(' OR ')})${f.sql}
    ORDER BY visitor_id, ts
    LIMIT ?
  `).all(siteId, startDay, endDay, ...matchers.flatMap(m => m.args), ...f.args, MAX_ROWS + 1) as Array<{
    v: string
    type: string
    name: string | null
    path: string | null
    ts: number
  }>

  const truncated = rows.length > MAX_ROWS
  if (truncated)
    rows.pop()

  const windowMs = funnel.windowMinutes * 60_000
  const reached = new Array(steps.length).fill(0) as number[]

  let i = 0
  while (i < rows.length) {
    const visitor = rows[i]!.v
    let progress = 0
    let furthest = 0 // count each visitor once per step even if they restart
    let lastTs = 0
    for (; i < rows.length && rows[i]!.v === visitor; i++) {
      const row = rows[i]!
      if (progress > 0 && row.ts - lastTs > windowMs)
        progress = 0 // too slow: this visitor starts over
      if (progress < steps.length && stepMatches(steps[progress]!, row)) {
        progress++
        lastTs = row.ts
        if (progress > furthest) {
          furthest = progress
          reached[progress - 1]!++
        }
      }
    }
  }

  const first = reached[0] || 0
  return {
    truncated,
    steps: steps.map((s, k) => ({
      ...s,
      visitors: reached[k]!,
      // share of the previous step / of everyone who entered
      fromPrevious: k === 0 ? 1 : (reached[k - 1]! > 0 ? reached[k]! / reached[k - 1]! : 0),
      fromFirst: first > 0 ? reached[k]! / first : 0,
    })),
  }
}
