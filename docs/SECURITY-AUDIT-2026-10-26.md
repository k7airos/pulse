# Security audit — 2026-10-26

Scope: server routes/utils, tracker, Nuxt module, admin UI, deploy scripts, dependencies.

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | High | `DELETE /v1/keys/:id` had no website check: a site-bound admin key could revoke any key, including the global admin key | Look up key, enforce website access; global keys need a global admin; 404 on unknown id |
| 2 | High | `POST /v1/websites` accepted site-bound admin keys (could create sites) | Requires a global admin key |
| 3 | High | `limit=-1` on `/events` became SQLite `LIMIT -1` (unlimited) → full-table dump / memory pressure; NaN ranges unvalidated | Central `intParam` / `rangeParams` clamping; range capped at 366 days |
| 4 | High | Domain allow-list in `/v1/collect` was a no-op (empty branch) and used substring matching | Hostname match (exact or subdomain), 403 on mismatch; `PULSE_ENFORCE_ORIGIN=0` opt-out |
| 5 | Medium | Rate limit keyed on spoofable first `X-Forwarded-For` hop; bucket map unbounded | `PULSE_TRUST_PROXY` + last hop / `X-Real-IP`; sweeping and hard cap |
| 6 | Medium | No brute-force protection for API keys | 30 failed attempts/min/IP → 429 |
| 7 | Medium | Truncated `props` JSON (`slice`) made `/events` throw 500 on read (stored DoS) | Drop keys until it fits; safe parse on read |
| 8 | Medium | No request body size limits; zod errors surfaced as 500 | 16 KB collect / 512 KB batch / 4 KB admin; 400 for invalid input, 413 for oversize |
| 9 | Medium | Client-supplied `ts` accepted blindly (forged/NaN day buckets) | Anonymous: server time only; keys: within -366d…+5min |
| 10 | Medium | Query strings/hashes stored in `path`/`url`/`referrer` (tokens, PII, aggregate fragmentation) | Stripped server-side |
| 11 | Medium | `/v1/health` disclosed the filesystem data dir and triggered bootstrap writes | Removed `dataDir` |
| 12 | Medium | Bootstrap key file world-readable; key printed to logs on write failure; weak env key accepted | mode 0600, never logged, min length 24 |
| 13 | Low | LIKE wildcards (`%`, `_`) in `pathPrefix` unescaped | Escaped with `ESCAPE` |
| 14 | Low | `lastUsedAt` written on every request | Throttled to once/min |
| 15 | Low | Ingest not atomic (raw row without rollups on failure) | Single SQLite transaction |
| 16 | Low | App bound to 0.0.0.0 (proxy bypass, XFF forgery); env file uploaded with default mode; `rm -rf` of unvalidated dir | Loopback bind, `chmod 600`, path guard in deploy script |
| 17 | Low | No security headers | `nosniff`, `X-Frame-Options`, `frame-ancestors 'none'`, Referrer-Policy |
| 18 | Low | Admin UI logged the user out on any 403 | Only 401 clears the session |
| 19 | — | Dependencies: 71 advisories (4 critical, 34 high) | `pnpm update` (nuxt 4.6, nuxt-ui 4.12, zod 4.6, …): 4 remain |

Residual risks (not fixed):
- Admin key lives in `localStorage` (XSS-readable). Mitigation would be an httpOnly session cookie.
- Public-id collect cannot be authenticated; header checks only stop cross-site pollution by browsers.
- `@tiptap/core` (Nuxt UI editor, unused), `node-forge` (dev server HTTPS, no patched release), `esbuild` (build-time) remain flagged by `pnpm audit`; none is in the runtime path.
- Day buckets use the server's local timezone.
