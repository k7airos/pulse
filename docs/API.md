# Pulse HTTP API

Base path: `/v1`
Auth: `x-api-key: pk_live_…` or `Authorization: Bearer pk_live_…`
Machine-readable spec: `GET /v1/openapi.json` (`?lang=en` for English text) · human docs: `/docs`.

Scopes: `collect` (ingest), `read` (query), `admin` (manage). A key can be bound to one website; a key without a website is a **global** key (only the bootstrap admin).

## Ingest

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/collect` | public id, or `collect` key | Pageview / event. Browsers need only the website's public id; its `Origin` must match the registered domain. |
| POST | `/v1/collect/batch` | `collect` | Up to 100 items; may backfill `ts`, set `country`/`browser`/`os`/`device`/`language`. |

## Query

All query endpoints accept a range — `days=N`, or `startDay`/`endDay` (`YYYY-MM-DD`, website timezone), or `startAt`/`endAt` (ms) — and **filters**: `path` (`*` suffix = prefix), `referrer`, `channel`, `utm_source`, `utm_medium`, `utm_campaign`, `country`, `browser`, `os`, `device`, `language`, `event`.

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| GET | `/v1/overview` | read | Every visible website: 1d/7d/30d windows with change, 14-day sparkline, visitors online |
| GET | `/v1/websites` | read | List websites |
| GET | `/v1/websites/:id` | read | Website detail |
| GET | `/v1/websites/:id/report` | read | Totals, daily series, optional `compare=prev\|year`, top panels, goals |
| GET | `/v1/websites/:id/stats` | read | Totals only |
| GET | `/v1/websites/:id/timeseries` | read | Zero-filled daily pageviews / events / visitors |
| GET | `/v1/websites/:id/metrics` | read | `type=` any dimension (legacy: `path`, `event`, `referrer`) |
| GET | `/v1/websites/:id/breakdown` | read | `by=` any dimension |
| GET | `/v1/websites/:id/goals` | read | Goals with conversion rate |
| GET | `/v1/websites/:id/funnels` | read | Funnels with visitors per step |
| GET | `/v1/websites/:id/events` | read | Raw events |
| GET | `/v1/websites/:id/interest` | read | Social-proof count for a path prefix or event |

## Manage

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| POST | `/v1/websites` | global admin | Create website (+ keys) |
| PATCH | `/v1/websites/:id` | admin | `name`, `domain`, `timezone`, `retentionDays` |
| DELETE | `/v1/websites/:id` | global admin | Delete website and all its data |
| POST | `/v1/websites/:id/goals` | admin | Create goal (`event` or `path`) |
| DELETE | `/v1/websites/:id/goals/:goalId` | admin | Delete goal |
| POST | `/v1/websites/:id/funnels` | admin | Create funnel (2–8 steps) |
| DELETE | `/v1/websites/:id/funnels/:funnelId` | admin | Delete funnel |
| POST / DELETE | `/v1/websites/:id/share` | admin | Create / rotate / stop the read-only share link |
| POST | `/v1/websites/:id/prune` | admin | Delete raw events older than N days |
| GET / POST | `/v1/websites/:id/keys` | admin | List key prefixes / create key (plain shown once) |
| DELETE | `/v1/keys/:id` | admin | Revoke key |

## Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/health` | Status, version, server timezone |
| GET | `/v1/share/:token/report` (`/breakdown`, `/funnels`) | Read-only report for a share link |
| GET | `/script.js` | Browser tracker |

See [AGENT.md](./AGENT.md) for curl examples.
