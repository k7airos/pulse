# Changelog

## Unreleased — open-source preparation

- MIT `LICENSE`, `SECURITY.md`, English and Chinese READMEs with screenshots.
- `Dockerfile`, `compose.yaml` and `.dockerignore` for self-hosting (non-root, volume at `/data`, healthcheck).
- `scripts/seed-demo.mjs` generates demo traffic for trying the UI.
- Removed server-specific deploy files (pm2 config, SSH deploy script, deploy env example); example hostnames are now `example.com`.
- Icons never fall back to a third-party API at runtime.

## 0.2.1 — 2026-10-27

### Changed
- New site icon: the same Pulse mark as the app header (favicon.svg, favicon.ico, apple-touch-icon) and a theme color.
- Version number now comes from `package.json` (health endpoint, OpenAPI document).

### Fixed (language coverage)
- API documentation is now served in the UI language (`/v1/openapi.json?lang=en`); English was previously Chinese-only.
- Server error messages are translated in the UI (invalid key, rate limit, not found, limits, …).
- Nuxt UI built-in strings (modal close, empty search results, …) follow the app language.
- Localized 404/error page; `<html lang>` follows the language; times use the selected language.
- Goal/funnel path placeholders no longer contain hard-coded Chinese.

## 0.2.0 — 2026-10-27

### Added
- Traffic sources: referrer host, channel (direct / organic search / social / referral / email / paid / campaign) and UTM source / medium / campaign. Every hit of a session inherits the session's entry source.
- Environment and geography: browser, OS, device, country (CDN header or bundled IP table), language. No IP address or raw user-agent is stored; crawlers are ignored.
- Global filters across every number, chart, goal and funnel (UI and API).
- Goals (event / page) with conversion rate and ordered funnels with a step time window.
- Period comparison (previous period / same period last year) and custom date ranges.
- Per-site timezone for day boundaries (changing it re-buckets history).
- Read-only public share links (`/share/:token`).
- Data retention: per-site and global (`PULSE_RETENTION_DAYS`) cleanup of raw events, manual cleanup, site deletion.
- API: `GET /v1/overview`, `/v1/websites/:id/{report,breakdown,timeseries,goals,funnels}`, `PATCH|DELETE /v1/websites/:id`, share and prune endpoints.
- UI rebuilt on `@akairos/design` (compact workbench density, light/dark): top-3 site cards plus a dense site table, a report page with ranked panels.

### Security
- Fixed missing website checks when revoking keys and creating websites with a site-bound admin key.
- Real Origin/Referer check against the registered domain; request-size limits; strict input validation; clamped limits and ranges.
- Trusted-proxy aware rate limiting, brute-force lockout, security headers, hardened bootstrap key handling, deploy script guards.
- Dependency updates (71 → 3 advisories, none in the runtime path). See `docs/SECURITY-AUDIT-2026-10-26.md`.

### Changed
- Visitors are now true distinct counts over a range (previously the sum of daily uniques).
- `path` is stored without query string/hash; `url` without hash; `referrer` without query/hash.
- Anonymous browser requests can no longer set the event timestamp.
- SPA tracker reports the previous page as referrer after the first pageview.
- `GET /v1/health` no longer returns the data directory.

### Upgrade notes
- The database migrates in place on first start (additive columns, backfill of existing events). Take a backup first.
- Behind a reverse proxy set `PULSE_TRUST_PROXY=1`, otherwise all clients share one rate-limit bucket.
- Builds with pnpm 10 need `onlyBuiltDependencies` (provided in `pnpm-workspace.yaml`).
