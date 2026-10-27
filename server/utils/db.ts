import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import * as schema from '../database/schema'
import { classifyChannel, hostOf, isSelfHost, parseUtm } from './enrich'
import { siteTz, tzDayKey } from './tz'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _sqlite: Database.Database | null = null

function resolveDataDir() {
  const config = useRuntimeConfig()
  if (config.pulseDataDir)
    return String(config.pulseDataDir)
  if (process.env.PULSE_DATA_DIR)
    return process.env.PULSE_DATA_DIR
  return join(process.cwd(), '.data')
}

export function getDataDir() {
  return resolveDataDir()
}

function hasColumn(sqlite: Database.Database, table: string, col: string) {
  return (sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some(c => c.name === col)
}

function addColumn(sqlite: Database.Database, table: string, col: string, ddl: string) {
  if (!hasColumn(sqlite, table, col))
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`)
}

function migrate(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS websites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT,
      public_id TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      website_id TEXT,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      scopes TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER,
      last_used_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS api_keys_website_idx ON api_keys(website_id);

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      website_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT,
      path TEXT,
      url TEXT,
      referrer TEXT,
      props TEXT,
      session_id TEXT,
      visitor_id TEXT,
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_website_ts_idx ON events(website_id, ts);
    CREATE INDEX IF NOT EXISTS events_website_name_idx ON events(website_id, name);
    CREATE INDEX IF NOT EXISTS events_website_path_idx ON events(website_id, path);

    CREATE TABLE IF NOT EXISTS daily_stats (
      id TEXT PRIMARY KEY,
      website_id TEXT NOT NULL,
      day TEXT NOT NULL,
      path TEXT NOT NULL DEFAULT '',
      event_name TEXT NOT NULL DEFAULT '',
      pageviews INTEGER NOT NULL DEFAULT 0,
      events INTEGER NOT NULL DEFAULT 0,
      visitors INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS daily_stats_uniq
      ON daily_stats(website_id, day, path, event_name);
    CREATE INDEX IF NOT EXISTS daily_stats_website_day_idx
      ON daily_stats(website_id, day);

    CREATE TABLE IF NOT EXISTS daily_visitors (
      id TEXT PRIMARY KEY,
      website_id TEXT NOT NULL,
      day TEXT NOT NULL,
      path TEXT NOT NULL DEFAULT '',
      event_name TEXT NOT NULL DEFAULT '',
      visitor_id TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS daily_visitors_uniq
      ON daily_visitors(website_id, day, path, event_name, visitor_id);

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      website_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS goals_website_idx ON goals(website_id);

    CREATE TABLE IF NOT EXISTS funnels (
      id TEXT PRIMARY KEY,
      website_id TEXT NOT NULL,
      name TEXT NOT NULL,
      steps TEXT NOT NULL,
      window_minutes INTEGER NOT NULL DEFAULT 1440,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS funnels_website_idx ON funnels(website_id);
  `)

  // --- additive column migrations (safe to re-run) ---
  addColumn(sqlite, 'websites', 'timezone', 'TEXT')
  addColumn(sqlite, 'websites', 'share_id', 'TEXT')
  addColumn(sqlite, 'websites', 'retention_days', 'INTEGER')
  addColumn(sqlite, 'websites', 'pruned_before', 'INTEGER')

  for (const [col, ddl] of [
    ['day', 'TEXT'],
    ['referrer_host', 'TEXT'],
    ['channel', 'TEXT'],
    ['utm_source', 'TEXT'],
    ['utm_medium', 'TEXT'],
    ['utm_campaign', 'TEXT'],
    ['utm_term', 'TEXT'],
    ['utm_content', 'TEXT'],
    ['country', 'TEXT'],
    ['browser', 'TEXT'],
    ['os', 'TEXT'],
    ['device', 'TEXT'],
    ['language', 'TEXT'],
  ] as const)
    addColumn(sqlite, 'events', col, ddl)

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS websites_share_idx ON websites(share_id);
    CREATE INDEX IF NOT EXISTS events_site_day_idx ON events(website_id, day);
    CREATE INDEX IF NOT EXISTS events_site_session_idx ON events(website_id, session_id);
  `)

  backfillEvents(sqlite)
}

/** One-time: derive day / referrer host / channel / utm for rows written before these columns existed. */
function backfillEvents(sqlite: Database.Database) {
  const pending = sqlite.prepare('SELECT COUNT(*) AS c FROM events WHERE day IS NULL').get() as { c: number }
  if (!pending.c)
    return

  const sites = new Map(
    (sqlite.prepare('SELECT id, domain, timezone FROM websites').all() as Array<{ id: string, domain: string | null, timezone: string | null }>)
      .map(s => [s.id, s]),
  )
  const sel = sqlite.prepare('SELECT id, website_id AS siteId, url, referrer, ts FROM events WHERE day IS NULL LIMIT 5000')
  const upd = sqlite.prepare(`
    UPDATE events SET day = ?, referrer_host = ?, channel = ?,
      utm_source = ?, utm_medium = ?, utm_campaign = ?, utm_term = ?, utm_content = ?
    WHERE id = ?
  `)

  console.info(`[pulse] migrating ${pending.c} existing events…`)
  const run = sqlite.transaction((rows: Array<{ id: string, siteId: string, url: string | null, referrer: string | null, ts: number }>) => {
    for (const r of rows) {
      const site = sites.get(r.siteId)
      const tz = siteTz(site || {})
      const utm = parseUtm(r.url)
      let host = hostOf(r.referrer)
      const internal = isSelfHost(host, site?.domain)
      if (internal)
        host = ''
      const channel = internal && !utm.utm_source && !utm.utm_medium ? null : classifyChannel(utm, host)
      upd.run(
        tzDayKey(r.ts, tz),
        host || null,
        channel,
        utm.utm_source,
        utm.utm_medium,
        utm.utm_campaign,
        utm.utm_term,
        utm.utm_content,
        r.id,
      )
    }
  })
  for (;;) {
    const rows = sel.all() as Parameters<typeof run>[0]
    if (!rows.length)
      break
    run(rows)
  }
  console.info('[pulse] event migration done')
}

export function useDb() {
  if (_db)
    return _db

  const dir = resolveDataDir()
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'pulse.sqlite')
  const sqlite = new Database(file)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  // Used for bulk re-bucketing when a site's timezone changes.
  sqlite.function('pulse_day', { deterministic: true }, (ts: number, tz: string) => tzDayKey(Number(ts), String(tz)))
  migrate(sqlite)
  _sqlite = sqlite
  _db = drizzle(sqlite, { schema })
  return _db
}

export function useSqlite() {
  useDb()
  return _sqlite!
}
