import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { and, eq, isNull } from 'drizzle-orm'
import { apiKeys, websites } from '../../database/schema'
import { useDb, getDataDir } from '../db'
import { clientIp } from '../http'
import { keyPrefixOf, newApiKeyPlain, newId } from '../ids'
import { rateLimit, rateLimitPeek } from '../rateLimit'

export type Scope = 'collect' | 'read' | 'admin'

export interface AuthContext {
  keyId: string
  websiteId: string | null
  scopes: Scope[]
  name: string
}

export function hashApiKey(plain: string) {
  return createHash('sha256').update(plain).digest('hex')
}

export function parseScopes(raw: string): Scope[] {
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean) as Scope[]
}

export function scopesToString(scopes: Scope[]) {
  return [...new Set(scopes)].join(',')
}

export function extractApiKey(event: { headers?: Headers } | { node?: { req?: { headers?: Record<string, string | string[] | undefined> } } }) {
  // H3: prefer getRequestHeader when available
  try {
    // @ts-expect-error h3 event
    const x = getRequestHeader(event, 'x-api-key')
    if (x?.trim())
      return x.trim()
    // @ts-expect-error h3 event
    const auth = getRequestHeader(event, 'authorization')
    if (auth && auth.toLowerCase().startsWith('bearer '))
      return auth.slice(7).trim()
  }
  catch { /* fall through */ }

  const h = (event as { node?: { req?: { headers?: Record<string, string | string[] | undefined> } } }).node?.req?.headers || {}
  const x = h['x-api-key']
  if (typeof x === 'string' && x.trim())
    return x.trim()
  if (Array.isArray(x) && x[0])
    return String(x[0]).trim()

  const auth = h.authorization
  const a = Array.isArray(auth) ? auth[0] : auth
  if (typeof a === 'string' && a.toLowerCase().startsWith('bearer '))
    return a.slice(7).trim()
  return null
}

export async function verifyApiKey(plain: string): Promise<AuthContext | null> {
  if (!plain)
    return null
  const db = useDb()
  const hash = hashApiKey(plain)
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).limit(1)
  const row = rows[0]
  if (!row || row.revokedAt)
    return null

  // Throttled: avoid a DB write on every single request.
  const now = Date.now()
  if (!row.lastUsedAt || now - row.lastUsedAt > 60_000) {
    try {
      await db.update(apiKeys)
        .set({ lastUsedAt: now })
        .where(eq(apiKeys.id, row.id))
    }
    catch { /* ignore */ }
  }

  return {
    keyId: row.id,
    websiteId: row.websiteId,
    scopes: parseScopes(row.scopes),
    name: row.name,
  }
}

export function hasScope(ctx: AuthContext, scope: Scope) {
  if (ctx.scopes.includes('admin'))
    return true
  return ctx.scopes.includes(scope)
}

export async function requireAuth(
  event: Parameters<typeof extractApiKey>[0] & { context: Record<string, unknown> },
  scope: Scope,
): Promise<AuthContext> {
  const ip = clientIp(event as never)
  const failKey = `authfail:${ip}`
  if (!rateLimitPeek(failKey))
    throw createError({ statusCode: 429, statusMessage: 'Too many failed attempts' })

  const plain = extractApiKey(event)
  if (!plain) {
    throw createError({ statusCode: 401, statusMessage: 'Missing API key (x-api-key or Bearer)' })
  }
  const ctx = await verifyApiKey(plain)
  if (!ctx) {
    rateLimit(failKey, 30, 60_000)
    throw createError({ statusCode: 401, statusMessage: 'Invalid or revoked API key' })
  }
  if (!hasScope(ctx, scope)) {
    throw createError({ statusCode: 403, statusMessage: `Missing scope: ${scope}` })
  }
  event.context.pulseAuth = ctx
  return ctx
}

/** Only keys not bound to a website (the bootstrap/global admin) may pass. */
export function assertGlobalAdmin(ctx: AuthContext) {
  if (ctx.websiteId || !hasScope(ctx, 'admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Global admin key required' })
  }
}

export async function insertApiKey(opts: {
  plain: string
  websiteId?: string | null
  name: string
  scopes: Scope[]
}) {
  const id = newId('key')
  const now = Date.now()
  const db = useDb()
  await db.insert(apiKeys).values({
    id,
    websiteId: opts.websiteId ?? null,
    name: opts.name,
    keyPrefix: keyPrefixOf(opts.plain),
    keyHash: hashApiKey(opts.plain),
    scopes: scopesToString(opts.scopes),
    createdAt: now,
    revokedAt: null,
    lastUsedAt: null,
  })
  return {
    id,
    name: opts.name,
    websiteId: opts.websiteId ?? null,
    keyPrefix: keyPrefixOf(opts.plain),
    scopes: opts.scopes,
    key: opts.plain,
    createdAt: now,
  }
}

export async function createApiKey(opts: {
  websiteId?: string | null
  name: string
  scopes: Scope[]
}) {
  return insertApiKey({
    plain: newApiKeyPlain(),
    websiteId: opts.websiteId,
    name: opts.name,
    scopes: opts.scopes,
  })
}

export async function listKeys(websiteId?: string | null) {
  const db = useDb()
  const cols = {
    id: apiKeys.id,
    websiteId: apiKeys.websiteId,
    name: apiKeys.name,
    keyPrefix: apiKeys.keyPrefix,
    scopes: apiKeys.scopes,
    createdAt: apiKeys.createdAt,
    revokedAt: apiKeys.revokedAt,
    lastUsedAt: apiKeys.lastUsedAt,
  }
  if (websiteId === undefined)
    return db.select(cols).from(apiKeys)
  if (websiteId === null)
    return db.select(cols).from(apiKeys).where(isNull(apiKeys.websiteId))
  return db.select(cols).from(apiKeys).where(eq(apiKeys.websiteId, websiteId))
}

export async function getKeyById(id: string) {
  const db = useDb()
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1)
  return rows[0] || null
}

export async function revokeKey(id: string) {
  const db = useDb()
  const now = Date.now()
  await db.update(apiKeys)
    .set({ revokedAt: now })
    .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
  return { id, revokedAt: now }
}

export async function resolveWebsiteByPublicId(publicId: string) {
  const db = useDb()
  const rows = await db.select().from(websites).where(eq(websites.publicId, publicId)).limit(1)
  return rows[0] || null
}

export async function resolveWebsiteById(id: string) {
  const db = useDb()
  const rows = await db.select().from(websites).where(eq(websites.id, id)).limit(1)
  return rows[0] || null
}

/** Ensure at least one non-revoked global admin key exists. */
export async function ensureBootstrapAdmin() {
  const db = useDb()
  const existing = await db.select().from(apiKeys)
    .where(and(isNull(apiKeys.websiteId), isNull(apiKeys.revokedAt)))
    .limit(1)
  if (existing.length)
    return { bootstrapped: false as const }

  const config = useRuntimeConfig()
  const envKey = String(config.pulseBootstrapAdminKey || process.env.PULSE_BOOTSTRAP_ADMIN_KEY || '').trim()
  if (envKey && envKey.length < 24) {
    console.error('[pulse] PULSE_BOOTSTRAP_ADMIN_KEY is shorter than 24 chars; ignoring it and generating a random key')
  }
  const useEnv = envKey.length >= 24
  const plain = useEnv ? envKey : newApiKeyPlain()
  const generated = !useEnv

  const created = await insertApiKey({
    plain,
    websiteId: null,
    name: 'bootstrap-admin',
    scopes: ['admin', 'read', 'collect'],
  })

  if (generated) {
    try {
      writeFileSync(join(getDataDir(), 'BOOTSTRAP_ADMIN_KEY.txt'), `${created.key}\n`, { encoding: 'utf8', mode: 0o600 })
      console.info('[pulse] Bootstrap admin key → PULSE_DATA_DIR/BOOTSTRAP_ADMIN_KEY.txt')
      console.info(`[pulse] prefix ${created.keyPrefix}…`)
    }
    catch {
      // Never print the secret to logs; the operator can set PULSE_BOOTSTRAP_ADMIN_KEY instead.
      console.error('[pulse] Could not write BOOTSTRAP_ADMIN_KEY.txt; set PULSE_BOOTSTRAP_ADMIN_KEY (>=24 chars) and restart with an empty data dir')
    }
  }
  else {
    console.info('[pulse] Bootstrap admin key loaded from PULSE_BOOTSTRAP_ADMIN_KEY')
  }

  return { bootstrapped: true as const, generated }
}

export function assertWebsiteAccess(ctx: AuthContext, websiteId: string) {
  if (hasScope(ctx, 'admin') && !ctx.websiteId)
    return
  if (ctx.websiteId && ctx.websiteId !== websiteId) {
    throw createError({ statusCode: 403, statusMessage: 'API key not allowed for this website' })
  }
}
