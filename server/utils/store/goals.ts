import { useSqlite } from '../db'
import { escapeLike } from '../http'
import { newId } from '../ids'
import { filterSql } from './filters'
import type { Filters } from './filters'

export interface Goal {
  id: string
  name: string
  type: 'path' | 'event'
  value: string
  createdAt: number
}

export function listGoals(siteId: string): Goal[] {
  return useSqlite().prepare(`
    SELECT id, name, type, value, created_at AS createdAt FROM goals WHERE website_id = ? ORDER BY created_at ASC
  `).all(siteId) as Goal[]
}

export function createGoal(siteId: string, g: Pick<Goal, 'name' | 'type' | 'value'>): Goal {
  const goal = { id: newId('goal'), ...g, createdAt: Date.now() }
  useSqlite().prepare(`
    INSERT INTO goals (id, website_id, name, type, value, created_at) VALUES (?, ?, ?, ?, ?, ?)
  `).run(goal.id, siteId, goal.name, goal.type, goal.value, goal.createdAt)
  return goal
}

export function deleteGoal(siteId: string, id: string) {
  return useSqlite().prepare('DELETE FROM goals WHERE id = ? AND website_id = ?').run(id, siteId).changes > 0
}

/** Predicate for "this event/pageview counts as the step/goal". */
export function matchSql(type: 'path' | 'event', value: string) {
  if (type === 'event')
    return { sql: `(type = 'event' AND name = ?)`, args: [value] }
  if (value.endsWith('*'))
    return { sql: `(type = 'pageview' AND path LIKE ? ESCAPE '\\')`, args: [`${escapeLike(value.slice(0, -1))}%`] }
  return { sql: `(type = 'pageview' AND path = ?)`, args: [value] }
}

export function goalStats(
  siteId: string,
  goal: Pick<Goal, 'type' | 'value'>,
  startDay: string,
  endDay: string,
  filters: Filters,
  totalVisitors: number,
) {
  const m = matchSql(goal.type, goal.value)
  const f = filterSql(filters)
  const r = useSqlite().prepare(`
    SELECT COUNT(*) AS c, COUNT(DISTINCT visitor_id) AS uv
    FROM events WHERE website_id = ? AND day BETWEEN ? AND ? AND ${m.sql}${f.sql}
  `).get(siteId, startDay, endDay, ...m.args, ...f.args) as { c: number, uv: number }
  const visitors = Number(r.uv || 0)
  return {
    conversions: Number(r.c || 0),
    visitors,
    rate: totalVisitors > 0 ? visitors / totalVisitors : 0,
  }
}
