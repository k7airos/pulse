# Migrating from Umami

Pulse does not import Umami's database. The safe path is to run both side by side until the numbers agree, then drop Umami.

## Phase A — dual write

1. Deploy Pulse, create the website and keys (`POST /v1/websites`).
2. Keep your existing Umami snippet untouched and add Pulse next to it:

   ```html
   <script defer src="https://pulse.example.com/script.js"
     data-website-id="ws_xxx" data-auto-track="true"></script>
   ```

   For Nuxt, use the bundled module (`modules/nuxt-pulse`) with `NUXT_PUBLIC_PULSE_HOST` and `NUXT_PUBLIC_PULSE_WEBSITE_ID`.
3. Send custom events with the same names to both (`window.pulse.track('signup', { plan: 'pro' })`).
4. Compare over a representative traffic window:

| Check | Umami | Pulse |
|-------|-------|-------|
| Page views by path | Pages | `breakdown?by=path` |
| Custom events | Events | `breakdown?by=event` |
| Sources | Referrers / UTM | `breakdown?by=referrer`, `channel`, `utm_source` |
| Countries, devices | Countries / Devices | `breakdown?by=country`, `device`, `browser`, `os` |

Visitor counts can differ (session and visitor definitions differ). Pageviews and named events should agree within the same order of magnitude; Pulse also drops known crawlers.

## Phase B — Pulse only

1. Remove the Umami snippet/module.
2. Point anything that read Umami at `GET /v1/websites/:id/report` or `/breakdown`.

## Notes

- Pulse stores `path` without the query string; UTM parameters are read from the page URL.
- A site's registered domain is enforced against the `Origin` of browser collects; add every domain you track from (comma separated), or set `PULSE_ENFORCE_ORIGIN=0`.
- Day boundaries follow the website timezone — set it so daily numbers line up with Umami's.
- Umami's collector protocol (`POST /api/send`) is not implemented.
