import { ensureBootstrapAdmin } from '../utils/auth/apiKey'
import { useDb } from '../utils/db'
import { countryOf } from '../utils/enrich'

export default defineNitroPlugin(async () => {
  try {
    useDb()
    await ensureBootstrapAdmin()
    // Fail loudly (once) if the bundled IP→country table is missing from the build.
    if (countryOf({}, '8.8.8.8') !== 'US')
      console.warn('[pulse] country lookup unavailable (geoip-country data missing); set a CDN country header instead')
  }
  catch (e) {
    console.error('[pulse] bootstrap failed', e)
  }
})
