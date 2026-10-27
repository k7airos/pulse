import { z } from 'zod'

export const collectItemSchema = z.object({
  websiteId: z.string().min(1).max(64), // public id
  type: z.enum(['pageview', 'event']),
  name: z.string().min(1).max(128).optional().nullable(),
  path: z.string().max(512).optional().nullable(),
  url: z.string().max(1024).optional().nullable(),
  referrer: z.string().max(1024).optional().nullable(),
  props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().nullable(),
  sessionId: z.string().max(64).optional().nullable(),
  visitorId: z.string().max(64).optional().nullable(),
  ts: z.number().optional().nullable(),
  /** Browser language (navigator.language). Trusted API keys may also pass the fields below. */
  language: z.string().max(16).optional().nullable(),
  country: z.string().length(2).optional().nullable(),
  browser: z.string().max(32).optional().nullable(),
  os: z.string().max(32).optional().nullable(),
  device: z.enum(['desktop', 'mobile', 'tablet']).optional().nullable(),
})

export const collectBodySchema = collectItemSchema

export const collectBatchSchema = z.object({
  items: z.array(collectItemSchema).min(1).max(100),
})
