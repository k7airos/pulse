/** Baseline hardening headers for every response (admin UI, docs and API). */
export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': 'frame-ancestors \'none\'; base-uri \'self\'; object-src \'none\'',
  })
})
