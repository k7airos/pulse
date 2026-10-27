/** Simple in-memory fixed-window limiter per key. Fine for single-node v1. */

const buckets = new Map<string, { tokens: number, updated: number, windowMs: number }>()
const MAX_BUCKETS = 50_000
let lastSweep = 0

function sweep(now: number) {
  // Drop expired buckets; hard-cap size so spoofed keys cannot exhaust memory.
  if (now - lastSweep < 30_000 && buckets.size < MAX_BUCKETS)
    return
  lastSweep = now
  for (const [k, b] of buckets) {
    if (now - b.updated > b.windowMs)
      buckets.delete(k)
  }
  if (buckets.size >= MAX_BUCKETS)
    buckets.clear()
}

export function rateLimit(key: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now()
  sweep(now)
  let b = buckets.get(key)
  if (!b || now - b.updated > windowMs) {
    b = { tokens: limit, updated: now, windowMs }
    buckets.set(key, b)
  }
  if (b.tokens <= 0)
    return false
  b.tokens -= 1
  return true
}

/** True while `key` still has budget; does not consume. */
export function rateLimitPeek(key: string): boolean {
  const b = buckets.get(key)
  if (!b || Date.now() - b.updated > b.windowMs)
    return true
  return b.tokens > 0
}
