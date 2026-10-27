import { pruneAll } from '../utils/store/maintenance'

/** Daily-ish cleanup of raw events according to each site's retention policy. */
export default defineNitroPlugin(() => {
  const run = () => {
    try {
      const removed = pruneAll()
      for (const r of removed)
        console.info(`[pulse] retention: site ${r.siteId} removed ${r.events} events, ${r.visitors} visitor rows`)
    }
    catch (e) {
      console.error('[pulse] retention failed', e)
    }
  }
  setTimeout(run, 2 * 60_000).unref()
  setInterval(run, 6 * 60 * 60_000).unref()
})
