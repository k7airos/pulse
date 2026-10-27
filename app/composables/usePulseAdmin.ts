const KEY_STORAGE = 'pulse_admin_key'

export function usePulseAdmin() {
  const { t } = useI18n()
  const { describeError } = useApiError()
  const apiKey = useState<string>('pulse-admin-key', () => '')
  const error = useState<string>('pulse-admin-error', () => '')
  const ready = useState<boolean>('pulse-admin-ready', () => false)
  const loggingIn = useState<boolean>('pulse-admin-logging-in', () => false)

  const isLoggedIn = computed(() => !!apiKey.value)

  function hydrateFromStorage() {
    if (import.meta.server)
      return
    try {
      if (!apiKey.value)
        apiKey.value = localStorage.getItem(KEY_STORAGE) || ''
    }
    catch { /* ignore */ }
    ready.value = true
  }

  onMounted(() => {
    hydrateFromStorage()
  })

  function saveKey(key: string) {
    apiKey.value = key.trim()
    error.value = ''
    try {
      localStorage.setItem(KEY_STORAGE, apiKey.value)
    }
    catch { /* ignore */ }
  }

  function clearKey() {
    apiKey.value = ''
    error.value = ''
    try {
      localStorage.removeItem(KEY_STORAGE)
    }
    catch { /* ignore */ }
  }

  async function api<T>(path: string, opts: { method?: string, body?: unknown } = {}): Promise<T> {
    error.value = ''
    if (!apiKey.value)
      throw new Error(t('errors.noKey'))
    try {
      return await $fetch<T>(path, {
        method: (opts.method || 'GET') as 'GET',
        body: opts.body as Record<string, unknown> | undefined,
        headers: {
          'x-api-key': apiKey.value,
        },
      })
    }
    catch (e: unknown) {
      const status = (e as { statusCode?: number, status?: number })?.statusCode
        || (e as { status?: number })?.status
      error.value = describeError(e)
      // Invalid/revoked key → force re-login. A 403 only means "this key lacks that scope".
      if (status === 401)
        clearKey()
      throw e
    }
  }

  /** Validate key then persist as session */
  async function login(key: string) {
    const trimmed = key.trim()
    if (!trimmed) {
      error.value = t('login.emptyKey')
      return false
    }
    loggingIn.value = true
    error.value = ''
    try {
      // Temporarily set for api()
      apiKey.value = trimmed
      await $fetch('/v1/websites', {
        headers: { 'x-api-key': trimmed },
      })
      saveKey(trimmed)
      return true
    }
    catch (e: unknown) {
      apiKey.value = ''
      error.value = describeError(e) || t('login.failed')
      return false
    }
    finally {
      loggingIn.value = false
    }
  }

  function logout() {
    clearKey()
  }

  return {
    apiKey,
    error,
    ready,
    loggingIn,
    isLoggedIn,
    saveKey,
    clearKey,
    login,
    logout,
    api,
    hydrateFromStorage,
  }
}
