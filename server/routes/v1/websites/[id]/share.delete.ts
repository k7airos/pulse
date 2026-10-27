import { useSqlite } from '../../../../utils/db'
import { loadSite } from '../../../../utils/siteRequest'

export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'admin')
  useSqlite().prepare('UPDATE websites SET share_id = NULL WHERE id = ?').run(site.id)
  return { ok: true }
})
