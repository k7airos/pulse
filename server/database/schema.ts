import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const websites = sqliteTable('websites', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  domain: text('domain'),
  publicId: text('public_id').notNull().unique(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  timezone: text('timezone'), // IANA; null = server zone
  shareId: text('share_id').unique(), // public read-only link token; null = not shared
  retentionDays: integer('retention_days'), // null = global default (PULSE_RETENTION_DAYS); 0 = keep forever
  prunedBefore: integer('pruned_before', { mode: 'number' }), // raw events older than this were deleted
})

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  websiteId: text('website_id'), // null = global (admin)
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  scopes: text('scopes').notNull(), // comma: collect,read,admin
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'number' }),
  lastUsedAt: integer('last_used_at', { mode: 'number' }),
}, table => [
  index('api_keys_website_idx').on(table.websiteId),
])

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  websiteId: text('website_id').notNull(),
  type: text('type').notNull(), // pageview | event
  name: text('name'), // event name; null for pageview
  path: text('path'),
  url: text('url'),
  referrer: text('referrer'),
  props: text('props'), // JSON string
  sessionId: text('session_id'),
  visitorId: text('visitor_id'),
  ts: integer('ts', { mode: 'number' }).notNull(),
  day: text('day'), // YYYY-MM-DD in the site's timezone at ingest
  referrerHost: text('referrer_host'), // session entry referrer (null = internal/none)
  channel: text('channel'), // direct|organic_search|social|referral|email|paid|campaign
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  utmTerm: text('utm_term'),
  utmContent: text('utm_content'),
  country: text('country'),
  browser: text('browser'),
  os: text('os'),
  device: text('device'),
  language: text('language'),
}, table => [
  index('events_website_ts_idx').on(table.websiteId, table.ts),
  index('events_website_name_idx').on(table.websiteId, table.name),
  index('events_website_path_idx').on(table.websiteId, table.path),
])

/** Daily aggregates for fast stats / interest */
export const dailyStats = sqliteTable('daily_stats', {
  id: text('id').primaryKey(),
  websiteId: text('website_id').notNull(),
  day: text('day').notNull(), // YYYY-MM-DD
  path: text('path').notNull().default(''), // empty = site-wide rollup
  eventName: text('event_name').notNull().default(''), // empty = pageviews rollup
  pageviews: integer('pageviews').notNull().default(0),
  events: integer('events').notNull().default(0),
  visitors: integer('visitors').notNull().default(0), // approximate unique visitors that day for this key
}, table => [
  uniqueIndex('daily_stats_uniq').on(table.websiteId, table.day, table.path, table.eventName),
  index('daily_stats_website_day_idx').on(table.websiteId, table.day),
])

/** Track unique visitors per day bucket (for accurate visitor counts on aggregates) */
export const dailyVisitors = sqliteTable('daily_visitors', {
  id: text('id').primaryKey(),
  websiteId: text('website_id').notNull(),
  day: text('day').notNull(),
  path: text('path').notNull().default(''),
  eventName: text('event_name').notNull().default(''),
  visitorId: text('visitor_id').notNull(),
}, table => [
  uniqueIndex('daily_visitors_uniq').on(
    table.websiteId,
    table.day,
    table.path,
    table.eventName,
    table.visitorId,
  ),
])

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  websiteId: text('website_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // path | event
  value: text('value').notNull(), // path (trailing * = prefix) or event name
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
})

export const funnels = sqliteTable('funnels', {
  id: text('id').primaryKey(),
  websiteId: text('website_id').notNull(),
  name: text('name').notNull(),
  steps: text('steps').notNull(), // JSON [{type,value}]
  windowMinutes: integer('window_minutes').notNull().default(1440),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
})

export type Website = typeof websites.$inferSelect
export type ApiKey = typeof apiKeys.$inferSelect
export type EventRow = typeof events.$inferSelect
