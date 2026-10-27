import { ensureBootstrapAdmin } from '../../utils/auth/apiKey'
import { useDb } from '../../utils/db'
import { SERVER_TZ } from '../../utils/tz'
import { PULSE_VERSION } from '../../utils/version'

export default defineEventHandler(async () => {
  useDb()
  await ensureBootstrapAdmin()
  // Public endpoint: no filesystem paths or other internals.
  return {
    ok: true,
    service: 'pulse',
    version: PULSE_VERSION,
    timezone: SERVER_TZ,
    ts: Date.now(),
  }
})
