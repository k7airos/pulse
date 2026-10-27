import type { H3Event } from 'h3'
import type { ZodType } from 'zod'

/**
 * Client IP used for rate limiting.
 *
 * X-Forwarded-For is client-controlled, so it is only consulted when the
 * operator states a trusted reverse proxy sits in front (PULSE_TRUST_PROXY=1).
 * Then we take the *last* hop (the one our proxy appended), never the first.
 */
export function clientIp(event: H3Event): string {
  if (process.env.PULSE_TRUST_PROXY === '1' || process.env.PULSE_TRUST_PROXY === 'true') {
    const real = getRequestHeader(event, 'x-real-ip')?.trim()
    if (real)
      return real
    const xff = getRequestHeader(event, 'x-forwarded-for')
    if (xff) {
      const last = xff.split(',').map(s => s.trim()).filter(Boolean).pop()
      if (last)
        return last
    }
  }
  return event.node.req.socket?.remoteAddress || 'unknown'
}

/** Read a JSON body with a hard size cap. Accepts text/plain JSON (sendBeacon). */
export async function readJsonBody(event: H3Event, maxBytes: number): Promise<unknown> {
  const declared = Number(getRequestHeader(event, 'content-length') || 0)
  if (declared > maxBytes)
    throw createError({ statusCode: 413, statusMessage: 'Payload too large' })

  const buf = await readRawBody(event, false)
  if (!buf || !buf.length)
    throw createError({ statusCode: 400, statusMessage: 'Empty body' })
  if (buf.length > maxBytes)
    throw createError({ statusCode: 413, statusMessage: 'Payload too large' })
  try {
    return JSON.parse(buf.toString('utf8'))
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON body' })
  }
}

/** Validate with zod and turn failures into 400 (never a 500 with a stack). */
export function parseWith<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data)
  if (!r.success) {
    const first = r.error.issues[0]
    const where = first?.path.length ? ` (${first.path.join('.')})` : ''
    throw createError({ statusCode: 400, statusMessage: `Invalid request${where}: ${first?.message || 'bad input'}` })
  }
  return r.data
}

/** Clamp a query value to an integer range; non-numeric falls back to `def`. */
export function intParam(raw: unknown, def: number, min: number, max: number): number {
  const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : Number.NaN
  if (!Number.isFinite(n))
    return def
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

const DAY_MS = 24 * 60 * 60 * 1000
export const MAX_RANGE_DAYS = 366

/** Validated [startAt, endAt] in ms; default last 7 days; range capped. */
export function rangeParams(q: Record<string, unknown>, defaultDays = 7) {
  const now = Date.now()
  const endAt = intParam(q.endAt, now, 0, now + DAY_MS)
  let startAt = intParam(q.startAt, endAt - defaultDays * DAY_MS, 0, endAt)
  if (endAt - startAt > MAX_RANGE_DAYS * DAY_MS)
    startAt = endAt - MAX_RANGE_DAYS * DAY_MS
  return { startAt, endAt }
}

/** Escape LIKE wildcards so user input is matched literally (use with ESCAPE '\'). */
export function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, m => `\\${m}`)
}
