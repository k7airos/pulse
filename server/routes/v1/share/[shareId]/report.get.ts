import { loadSharedSite } from '../../../../utils/siteRequest'
import { buildReport } from '../../../../utils/store/report'

/** Public, read-only report for a share link. Exposes name/domain/timezone only. */
export default defineEventHandler((event) => {
  const site = loadSharedSite(event)
  const report = buildReport(site, getQuery(event))
  return { ...report, website: { name: site.name, domain: site.domain, tz: report.range.tz } }
})
