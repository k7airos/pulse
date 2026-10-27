/**
 * Ensure browser collect works cross-origin (app.example.com → pulse.example.com).
 * routeRules cors alone was returning OPTIONS 404, which blocks preflight.
 */
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/v1/collect') && path !== '/script.js')
    return

  const origin = getRequestHeader(event, 'origin') || '*'
  setResponseHeader(event, 'Access-Control-Allow-Origin', origin)
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, Authorization')
  setResponseHeader(event, 'Access-Control-Max-Age', '86400')
  setResponseHeader(event, 'Vary', 'Origin')

  if (getMethod(event) === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }
})
