// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: true,
  modules: ['@nuxt/ui', '@nuxtjs/i18n'],
  css: ['~/assets/css/main.css'],
  colorMode: {
    preference: 'system',
    fallback: 'dark',
    classSuffix: '',
  },
  ui: {
    fonts: false,
  },
  // Everything the UI uses is bundled; never fall back to fetching icons from a third-party API.
  icon: {
    fallbackToApi: false,
  },
  i18n: {
    locales: [
      { code: 'zh-CN', language: 'zh-CN', name: '中文', file: 'zh-CN.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
    ],
    defaultLocale: 'zh-CN',
    lazy: true,
    // relative to restructureDir (default: i18n/) → i18n/locales/
    langDir: 'locales',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'pulse_i18n',
      redirectOn: 'root',
      fallbackLocale: 'zh-CN',
    },
    bundle: {
      optimizeTranslationDirective: false,
    },
  },
  runtimeConfig: {
    pulseDataDir: process.env.PULSE_DATA_DIR || '',
    pulseBootstrapAdminKey: process.env.PULSE_BOOTSTRAP_ADMIN_KEY || '',
    public: {
      appName: 'Pulse',
    },
  },
  nitro: {
    esbuild: {
      options: {
        target: 'node20',
      },
    },
    moduleSideEffects: ['better-sqlite3'],
    rollupConfig: {
      external: ['better-sqlite3'],
    },
    // geoip-country reads its IP→country tables with fs at runtime, which static tracing misses
    externals: {
      traceInclude: [
        'node_modules/geoip-country/data/geoip-country.dat',
        'node_modules/geoip-country/data/geoip-country6.dat',
      ],
    },
  },
  vite: {
    optimizeDeps: {
      exclude: ['better-sqlite3'],
    },
  },
  app: {
    head: {
      htmlAttrs: { 'data-ui-density': 'compact' },
      title: 'Pulse',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#750EE4' },
        // Default fallback; pages override via useSeoMeta + i18n
        { name: 'description', content: 'Pulse Analytics' },
      ],
    },
  },
  routeRules: {
    '/v1/collect': { cors: true },
    '/v1/collect/**': { cors: true },
    '/script.js': { cors: true, headers: { 'cache-control': 'public, max-age=300' } },
  },
})
