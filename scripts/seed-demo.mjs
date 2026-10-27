#!/usr/bin/env node
/**
 * Fill a Pulse instance with generated demo traffic (sites, sessions, sources, devices,
 * countries, goals, funnels). For trying the UI and taking screenshots — not real data.
 *
 *   node scripts/seed-demo.mjs http://127.0.0.1:4592 pk_live_yourAdminKey
 */
const [base = 'http://127.0.0.1:4592', key = process.env.PULSE_ADMIN_KEY] = process.argv.slice(2)
if (!key) {
  console.error('usage: node scripts/seed-demo.mjs <pulse-url> <admin-key>')
  process.exit(1)
}
const headers = { 'x-api-key': key, 'content-type': 'application/json' }
const api = async (path, init = {}) => {
  const r = await fetch(`${base}${path}`, { ...init, headers })
  if (r.status === 429) {
    await new Promise(res => setTimeout(res, 61_000))
    return api(path, init)
  }
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${path} → ${r.status} ${await r.text()}`)
  return r.json()
}

const rnd = n => Math.floor(Math.random() * n)
const pick = a => a[rnd(a.length)]
const weighted = (pairs) => {
  let r = Math.random() * pairs.reduce((s, p) => s + p[1], 0)
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v
  return pairs[0][0]
}

const SITES = [
  ['Acme Docs', 'docs.acme.dev', 1, ['/', '/guide/install', '/guide/config', '/api/reference', '/pricing', '/changelog', '/blog/launch']],
  ['Acme Shop', 'shop.acme.dev', 0.85, ['/', '/products', '/products/keyboard', '/products/mouse', '/cart', '/checkout', '/about']],
  ['Maple Blog', 'blog.maple.me', 0.55, ['/', '/posts/hello-world', '/posts/self-hosting', '/posts/analytics', '/about', '/archive']],
  ['Status Page', 'status.acme.dev', 0.3, ['/', '/history', '/incidents/42']],
  ['Landing — Beta', 'beta.acme.dev', 0.22, ['/', '/signup', '/pricing', '/faq']],
  ['Design System', 'design.acme.dev', 0.16, ['/', '/tokens', '/components/button', '/components/modal']],
  ['Community Forum', 'forum.acme.dev', 0.12, ['/', '/t/welcome', '/t/help', '/c/ideas']],
  ['Careers', 'jobs.acme.dev', 0.07, ['/', '/roles/engineer', '/roles/designer']],
  ['Newsletter', 'news.maple.me', 0.05, ['/', '/issues/12', '/subscribe']],
  ['Playground', 'play.acme.dev', 0.03, ['/', '/editor']],
]
const BROWSERS = [['Chrome', 52], ['Safari', 22], ['Edge', 9], ['Firefox', 8], ['Samsung', 4], ['WeChat', 5]]
const OSES = [['Windows', 32], ['macOS', 24], ['iOS', 20], ['Android', 19], ['Linux', 5]]
const COUNTRIES = [['US', 30], ['CN', 14], ['DE', 8], ['GB', 8], ['JP', 7], ['FR', 5], ['IN', 6], ['BR', 5], ['CA', 5], ['SG', 4], ['AU', 4], ['KR', 4]]
const LANGS = [['en', 55], ['zh', 14], ['de', 8], ['ja', 7], ['fr', 5], ['pt', 4], ['ko', 4], ['hi', 3]]
const SOURCES = [
  { ref: '', utm: '', w: 26 },
  { ref: 'https://www.google.com/', utm: '', w: 22 },
  { ref: 'https://duckduckgo.com/', utm: '', w: 5 },
  { ref: 'https://github.com/', utm: '', w: 9 },
  { ref: 'https://news.ycombinator.com/', utm: '', w: 8 },
  { ref: 'https://www.reddit.com/', utm: '', w: 6 },
  { ref: 'https://twitter.com/', utm: '', w: 5 },
  { ref: '', utm: '?utm_source=newsletter&utm_medium=email&utm_campaign=spring-launch', w: 7 },
  { ref: '', utm: '?utm_source=twitter&utm_medium=social&utm_campaign=spring-launch', w: 5 },
  { ref: '', utm: '?utm_source=google&utm_medium=cpc&utm_campaign=brand', w: 4 },
]
const DAYS = 30
const now = Date.now()

for (const [name, domain, scale, paths] of SITES) {
  const { website } = await api('/v1/websites', { method: 'POST', body: JSON.stringify({ name, domain, withKeys: false }) })
  const items = []
  for (let d = DAYS - 1; d >= 0; d--) {
    const weekend = [0, 6].includes(new Date(now - d * 86_400_000).getDay())
    const sessions = Math.round((70 + rnd(40)) * scale * (weekend ? 0.7 : 1) * (1 + (DAYS - d) / (DAYS * 2.5)))
    for (let i = 0; i < sessions; i++) {
      const ts0 = now - d * 86_400_000 - rnd(d === 0 ? 3_600_000 * 10 : 86_400_000)
      if (ts0 > now - 2000) continue
      const visitorId = `v${d}-${rnd(Math.max(10, Math.round(sessions * 0.7)))}`
      const sessionId = `s${d}-${i}`
      const env = { browser: weighted(BROWSERS), os: weighted(OSES), country: weighted(COUNTRIES), language: weighted(LANGS) }
      env.device = ['iOS', 'Android'].includes(env.os) ? 'mobile' : 'desktop'
      const src = weighted(SOURCES.map(s => [s, s.w]))
      let ts = ts0
      const views = 1 + rnd(4)
      for (let p = 0; p < views; p++) {
        const path = p === 0 ? paths[0] : pick(paths)
        items.push({ websiteId: website.publicId, type: 'pageview', path, url: `https://${domain}${path}${p === 0 ? src.utm : ''}`, referrer: p === 0 ? src.ref : `https://${domain}/`, visitorId, sessionId, ts, ...env })
        ts += 15_000 + rnd(120_000)
      }
      if (Math.random() < 0.2) items.push({ websiteId: website.publicId, type: 'event', name: 'signup', path: '/signup', visitorId, sessionId, ts: ts + 3000, ...env })
      if (Math.random() < 0.1) items.push({ websiteId: website.publicId, type: 'event', name: 'purchase', path: '/checkout', visitorId, sessionId, ts: ts + 9000, ...env })
    }
  }
  items.sort((a, b) => a.ts - b.ts)
  for (let i = 0; i < items.length; i += 100)
    await api('/v1/collect/batch', { method: 'POST', body: JSON.stringify({ items: items.slice(i, i + 100) }) })

  // a few visitors "online now"
  const online = Array.from({ length: Math.round(scale * 6) }, (_, i) => ({ websiteId: website.publicId, type: 'pageview', path: paths[0], visitorId: `live${i}`, sessionId: `live${i}`, ts: now - rnd(150_000) }))
  if (online.length) await api('/v1/collect/batch', { method: 'POST', body: JSON.stringify({ items: online }) })

  if (scale >= 0.5) {
    await api(`/v1/websites/${website.id}/goals`, { method: 'POST', body: JSON.stringify({ name: 'Signup', type: 'event', value: 'signup' }) })
    await api(`/v1/websites/${website.id}/goals`, { method: 'POST', body: JSON.stringify({ name: 'Visit pricing', type: 'path', value: paths.includes('/pricing') ? '/pricing' : paths[1] }) })
    await api(`/v1/websites/${website.id}/funnels`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Landing → Signup',
        steps: [{ type: 'path', value: paths[0] }, { type: 'path', value: paths[1] }, { type: 'event', value: 'signup' }],
      }),
    })
  }
  console.log(`${name}: ${items.length} hits`)
}
