/** Turn the API's English `statusMessage` into the current UI language. */

const EXACT: Record<string, string> = {
  'Missing API key (x-api-key or Bearer)': 'missingKey',
  'Invalid or revoked API key': 'invalidKey',
  'API key not allowed for this website': 'keyNotAllowed',
  'Key not allowed for website': 'keyNotAllowed',
  'Global admin key required': 'globalAdmin',
  'Too many failed attempts': 'tooManyAttempts',
  'Rate limit': 'rateLimit',
  'Payload too large': 'tooLarge',
  'Invalid JSON body': 'invalidJson',
  'Empty body': 'emptyBody',
  'Website not found': 'siteNotFound',
  'Key not found': 'keyNotFound',
  'Goal not found': 'goalNotFound',
  'Funnel not found': 'funnelNotFound',
  'Share link not found': 'shareNotFound',
  'Goal limit (50) reached': 'goalLimit',
  'Funnel limit (20) reached': 'funnelLimit',
  'Invalid timezone (IANA name expected)': 'invalidTz',
  'Origin not allowed for this website': 'originNotAllowed',
  'Unknown websiteId (public id)': 'unknownWebsite',
  'Invalid collect key': 'invalidKey',
}

export function useApiError() {
  const { t, te } = useI18n()

  function describeError(e: unknown): string {
    const x = e as { data?: { statusMessage?: string }, statusMessage?: string, message?: string, statusCode?: number }
    const raw = x?.data?.statusMessage || x?.statusMessage || x?.message || ''
    const key = EXACT[raw]
    if (key && te(`apiErrors.${key}`))
      return t(`apiErrors.${key}`)
    const scope = /^Missing scope: (\w+)/.exec(raw)
    if (scope)
      return t('apiErrors.missingScope', { scope: scope[1] })
    if (raw.startsWith('Invalid request'))
      return t('apiErrors.invalidRequest')
    if (raw.startsWith('No retention configured'))
      return t('apiErrors.noRetention')
    return raw || t('errors.requestFailed')
  }

  return { describeError }
}
