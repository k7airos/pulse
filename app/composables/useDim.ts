/** Labels for breakdown dimensions and their values. */

export type Dim =
  | 'path' | 'event' | 'referrer' | 'channel'
  | 'utm_source' | 'utm_medium' | 'utm_campaign'
  | 'browser' | 'os' | 'device' | 'country' | 'language'

export function useDim() {
  const { t, te, locale } = useI18n()

  function nameOf(kind: 'region' | 'language', code: string) {
    try {
      return new Intl.DisplayNames([locale.value], { type: kind }).of(code) || code
    }
    catch {
      return code
    }
  }

  function dimLabel(by: Dim | string) {
    return te(`dim.${by}`) ? t(`dim.${by}`) : by
  }

  function valueLabel(by: Dim | string, x: string) {
    if (by === 'channel' || by === 'device')
      return te(`${by}.${x}`) ? t(`${by}.${x}`) : x
    if (by === 'country')
      return nameOf('region', x)
    if (by === 'language')
      return nameOf('language', x)
    return x
  }

  /** Dimensions whose values are free text/paths (render monospace). */
  const mono = (by: Dim | string) => by === 'path' || by === 'event' || by === 'referrer' || by.startsWith('utm_')

  return { dimLabel, valueLabel, mono }
}
