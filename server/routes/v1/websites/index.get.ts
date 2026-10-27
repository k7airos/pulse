import { websites } from '../../../database/schema'
import { requireAuth } from '../../../utils/auth/apiKey'
import { useDb } from '../../../utils/db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event, 'read')
  const db = useDb()

  if (auth.websiteId) {
    const rows = await db.select().from(websites).where(eq(websites.id, auth.websiteId))
    return { websites: rows }
  }

  const rows = await db.select().from(websites)
  return { websites: rows }
})
