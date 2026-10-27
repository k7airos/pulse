import geoip from 'geoip-country'

/** Request/URL enrichment at ingest. No IP, UA string or other raw identifier is stored. */

export interface Env {
  browser: string | null
  os: string | null
  device: string | null
}

const BOT_RE = /bot\b|crawler|spider|slurp|headless|lighthouse|facebookexternalhit|bingpreview|pingdom|uptimerobot|monitor/i

export function isBot(ua: string | undefined) {
  return !!ua && BOT_RE.test(ua)
}

export function parseUA(ua: string | undefined): Env {
  if (!ua)
    return { browser: null, os: null, device: null }

  let browser = 'Other'
  if (/MicroMessenger/i.test(ua))
    browser = 'WeChat'
  else if (/QQBrowser|MQQBrowser/i.test(ua))
    browser = 'QQ Browser'
  else if (/UCBrowser|UCWEB/i.test(ua))
    browser = 'UC'
  else if (/SamsungBrowser/i.test(ua))
    browser = 'Samsung'
  else if (/EdgA?\/|Edge\//i.test(ua))
    browser = 'Edge'
  else if (/OPR\/|Opera/i.test(ua))
    browser = 'Opera'
  else if (/Firefox\/|FxiOS/i.test(ua))
    browser = 'Firefox'
  else if (/Chrome\/|CriOS/i.test(ua))
    browser = 'Chrome'
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua))
    browser = 'Safari'
  else if (/MSIE |Trident\//i.test(ua))
    browser = 'IE'

  let os = 'Other'
  if (/HarmonyOS|OpenHarmony/i.test(ua))
    os = 'HarmonyOS'
  else if (/Android/i.test(ua))
    os = 'Android'
  else if (/iPhone|iPad|iPod/i.test(ua))
    os = 'iOS'
  else if (/CrOS/i.test(ua))
    os = 'ChromeOS'
  else if (/Windows/i.test(ua))
    os = 'Windows'
  else if (/Mac OS X|Macintosh/i.test(ua))
    os = 'macOS'
  else if (/Linux|X11/i.test(ua))
    os = 'Linux'

  let device = 'desktop'
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)))
    device = 'tablet'
  else if (/Mobi|iPhone|iPod|Android/i.test(ua))
    device = 'mobile'

  return { browser, os, device }
}

const SEARCH = /(^|\.)(google|bing|baidu|sogou|so|yahoo|duckduckgo|yandex|ecosia|naver|sm|startpage|brave|search)\.[a-z.]+$|^search\.|^(www\.)?so\.com$|^m\.sm\.cn$/i
const SOCIAL = /(^|\.)(twitter|t|x|facebook|fb|instagram|linkedin|lnkd|weibo|t\.cn|zhihu|xiaohongshu|xhslink|douban|reddit|youtube|youtu|tiktok|douyin|bilibili|b23|weixin|wechat|qq|telegram|t\.me|discord|pinterest|medium|v2ex|juejin|jike|okjike|threads|bsky)\.[a-z.]+$|^mp\.weixin\.qq\.com$|^t\.co$|^lnkd\.in$|^t\.me$|^b23\.tv$/i

export function hostOf(ref: string | null | undefined) {
  if (!ref)
    return ''
  try {
    return new URL(ref).hostname.replace(/^www\./, '').toLowerCase()
  }
  catch {
    return ''
  }
}

/** Is `host` the registered site domain (or one of its subdomains)? `domainSpec` may be a comma list. */
export function isSelfHost(host: string, domainSpec: string | null | undefined) {
  if (!host || !domainSpec)
    return false
  return domainSpec.split(',').some((d) => {
    const dom = hostOf(d.includes('://') ? d : `https://${d.trim()}`)
    return !!dom && (host === dom || host.endsWith(`.${dom}`))
  })
}

export interface Utm {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

export function parseUtm(url: string | null | undefined): Utm {
  const out: Utm = { utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null }
  if (!url)
    return out
  try {
    const q = new URL(url, 'https://x.invalid').searchParams
    for (const k of UTM_KEYS) {
      const v = q.get(k)?.trim().toLowerCase().slice(0, 128)
      if (v)
        out[k] = v
    }
  }
  catch { /* ignore */ }
  return out
}

export type Channel = 'direct' | 'organic_search' | 'social' | 'referral' | 'email' | 'paid' | 'campaign'

export function classifyChannel(utm: Utm, refHost: string): Channel {
  const medium = utm.utm_medium || ''
  if (/^(cpc|ppc|paid|paidsearch|paid-search|display|banner|cpm|retargeting)$/.test(medium))
    return 'paid'
  if (/^(email|e-mail|newsletter|mail)$/.test(medium))
    return 'email'
  if (/^(social|social-media|sm)$/.test(medium))
    return 'social'
  if (/^(organic|search)$/.test(medium))
    return 'organic_search'
  if (utm.utm_source || medium || utm.utm_campaign)
    return 'campaign'
  if (refHost) {
    if (SEARCH.test(refHost))
      return 'organic_search'
    if (SOCIAL.test(refHost))
      return 'social'
    return 'referral'
  }
  return 'direct'
}

/** Country from a trusted proxy/CDN header, falling back to the bundled IP→country table. */
export function countryOf(headers: Record<string, string | undefined>, ip: string): string | null {
  const h = (headers['cf-ipcountry'] || headers['x-vercel-ip-country'] || headers['x-country-code'] || '').trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(h) && h !== 'XX' && h !== 'T1')
    return h
  if (!ip || ip === 'unknown')
    return null
  try {
    return geoip.lookup(ip.replace(/^::ffff:/, ''))?.country || null
  }
  catch {
    return null
  }
}

export function normLanguage(lang: string | null | undefined) {
  const l = (lang || '').trim().slice(0, 16)
  return l ? l.split(/[-_]/)[0]!.toLowerCase() : null
}
