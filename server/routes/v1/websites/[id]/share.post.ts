import { useSqlite } from '../../../../utils/db'
import { newShareId } from '../../../../utils/ids'
import { loadSite } from '../../../../utils/siteRequest'

/** Create (or rotate) the read-only share link. The old link stops working. */
export default defineEventHandler(async (event) => {
  const site = await loadSite(event, 'admin')
  const shareId = newShareId()
  useSqlite().prepare('UPDATE websites SET share_id = ? WHERE id = ?').run(shareId, site.id)
  return { shareId, path: `/share/${shareId}` }
})
