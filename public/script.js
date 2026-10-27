/**
 * Pulse browser tracker — drop-in script.
 * Uses text/plain body to avoid CORS preflight on cross-origin collect.
 */
;(function () {
  'use strict'

  var script = document.currentScript
  var host = (script && script.getAttribute('data-host')) || ''
  var websiteId = (script && script.getAttribute('data-website-id')) || ''
  var autoTrack = !script || script.getAttribute('data-auto-track') !== 'false'
  // Opt-in: data-do-not-track="true" disables tracking for browsers sending DNT.
  var honourDnt = !!script && script.getAttribute('data-do-not-track') === 'true'
  var dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1'
  if (honourDnt && dnt) {
    window.pulse = { track: function () {}, trackPageview: function () {}, collect: function () {}, config: function () {} }
    return
  }

  if (!host && script && script.src) {
    try {
      var u = new URL(script.src)
      host = u.origin
    } catch (_) {}
  }

  function rid(prefix) {
    return (
      prefix +
      '_' +
      Math.random().toString(36).slice(2) +
      Date.now().toString(36)
    )
  }

  function storageGet(k) {
    try {
      return localStorage.getItem(k)
    } catch (_) {
      return null
    }
  }
  function storageSet(k, v) {
    try {
      localStorage.setItem(k, v)
    } catch (_) {}
  }

  var visitorKey = 'pulse_vid'
  var sessionKey = 'pulse_sid'
  var sessionTsKey = 'pulse_sid_ts'
  var SESSION_MS = 30 * 60 * 1000

  function visitorId() {
    var v = storageGet(visitorKey)
    if (!v) {
      v = rid('v')
      storageSet(visitorKey, v)
    }
    return v
  }

  function sessionId() {
    var now = Date.now()
    var sid = storageGet(sessionKey)
    var ts = Number(storageGet(sessionTsKey) || 0)
    if (!sid || !ts || now - ts > SESSION_MS) {
      sid = rid('s')
      storageSet(sessionKey, sid)
    }
    storageSet(sessionTsKey, String(now))
    return sid
  }

  // First hit of a page load reports the real referrer; later SPA navigations report the
  // previous page (document.referrer never changes on pushState and would re-count the source).
  var currentRef = document.referrer || ''

  function collect(payload) {
    if (!websiteId || !host) return Promise.resolve()
    var body = Object.assign(
      {
        websiteId: websiteId,
        sessionId: sessionId(),
        visitorId: visitorId(),
        url: location.href,
        referrer: currentRef,
        language: navigator.language || '',
        path: location.pathname + location.search,
        ts: Date.now(),
      },
      payload,
    )
    var url = host.replace(/\/$/, '') + '/v1/collect'
    var raw = JSON.stringify(body)
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([raw], { type: 'text/plain' })
        if (navigator.sendBeacon(url, blob)) return Promise.resolve()
      }
    } catch (_) {}
    return fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: raw,
      keepalive: true,
      mode: 'cors',
      credentials: 'omit',
    }).catch(function () {})
  }

  function trackPageview(path) {
    var p = path || location.pathname + location.search
    var res = collect({ type: 'pageview', path: p })
    currentRef = location.origin + p
    return res
  }

  function track(name, props) {
    return collect({
      type: 'event',
      name: name,
      props: props || {},
    })
  }

  var lastPath = ''
  function autoPageview() {
    var p = location.pathname + location.search
    // Only skip duplicate within the same continuous SPA session for identical path
    // Full page reload resets lastPath → counts again (correct PV behavior)
    if (p === lastPath) return
    lastPath = p
    trackPageview(p)
  }

  if (autoTrack && websiteId) {
    if (document.readyState === 'complete') autoPageview()
    else window.addEventListener('load', autoPageview)
    var push = history.pushState
    var replace = history.replaceState
    history.pushState = function () {
      push.apply(history, arguments)
      setTimeout(autoPageview, 0)
    }
    history.replaceState = function () {
      replace.apply(history, arguments)
      setTimeout(autoPageview, 0)
    }
    window.addEventListener('popstate', function () {
      setTimeout(autoPageview, 0)
    })
  }

  window.pulse = {
    track: track,
    trackPageview: trackPageview,
    collect: collect,
    config: function (opts) {
      if (opts.host) host = opts.host
      if (opts.websiteId) websiteId = opts.websiteId
    },
  }
})()
