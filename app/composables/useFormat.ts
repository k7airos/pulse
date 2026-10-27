/** Locale-aware number / delta formatting */

export function useFormat() {
  const { t, locale } = useI18n()

  /**
   * Always returns a non-empty string.
   * - valid change → "+12.3%" / "-5%" / "0%"
   * - no baseline / invalid → "—"
   */
  function formatDelta(change: number | null | undefined): string {
    if (change === null || change === undefined)
      return t('delta.na')
    if (!Number.isFinite(change))
      return t('delta.na')
    // cap extreme display for readability but always show %
    const pct = Math.round(change * 1000) / 10
    if (pct === 0)
      return '0%'
    const sign = pct > 0 ? '+' : ''
    return `${sign}${pct}%`
  }

  function deltaTone(change: number | null | undefined): 'up' | 'down' | 'flat' | 'empty' {
    if (change === null || change === undefined || !Number.isFinite(change))
      return 'empty'
    if (change > 0.0005)
      return 'up'
    if (change < -0.0005)
      return 'down'
    return 'flat'
  }

  function formatNum(n: number | undefined | null): string {
    if (n === undefined || n === null)
      return t('delta.na')
    if (locale.value === 'zh-CN' && n >= 10000) {
      return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '')}${t('num.wan')}`
    }
    if (locale.value !== 'zh-CN' && n >= 10000) {
      return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '')}${t('num.k')}`
    }
    return String(n)
  }

  function periodLabel(key: string) {
    return t(`period.${key}`)
  }

  function periodCompareLabel(key: string) {
    return t(`period.cmp_${key}`)
  }

  return {
    formatDelta,
    deltaTone,
    formatNum,
    periodLabel,
    periodCompareLabel,
  }
}
