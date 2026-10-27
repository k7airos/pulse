import { requireAuth } from '../../utils/auth/apiKey'
import { useSqlite } from '../../utils/db'
import { getOverviewForSites } from '../../utils/store/overview'

/**
 * Dashboard feed: every website the key can see, with 1d/7d/30d windows,
 * a 14-day pageview sparkline and "online now" visitors — in one request.
 */
export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event, 'read')
  const sqlite = useSqlite()

  // Optional ?websiteId= narrows to one site (still limited to what the key may see).
  const only = getQuery(event).websiteId
  const scope = auth.websiteId || (typeof only === 'string' && only ? only : null)
  if (auth.websiteId && typeof only === 'string' && only && only !== auth.websiteId)
    throw createError({ statusCode: 403, statusMessage: 'API key not allowed for this website' })

  const cols = 'id, name, domain, public_id AS publicId, created_at AS createdAt, timezone'
  const sites = (scope
    ? sqlite.prepare(`SELECT ${cols} FROM websites WHERE id = ?`).all(scope)
    : sqlite.prepare(`SELECT ${cols} FROM websites ORDER BY created_at DESC`).all()
  ) as Array<{ id: string, name: string, domain: string | null, publicId: string, createdAt: number, timezone: string | null }>

  const data = getOverviewForSites(sites)
  const byId = new Map(data.map(d => [d.websiteId, d]))
  return {
    now: Date.now(),
    sites: sites.map(s => ({ ...s, ...byId.get(s.id)! })),
  }
})
