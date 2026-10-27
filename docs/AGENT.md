# Pulse for Agents

All management and read paths use **API keys**. No browser login required.

## Headers

```
x-api-key: pk_live_…
# or
Authorization: Bearer pk_live_…
```

## Bootstrap

1. Start Pulse once. If no admin key exists:
   - uses `PULSE_BOOTSTRAP_ADMIN_KEY` env, or
   - writes a generated key to `$PULSE_DATA_DIR/BOOTSTRAP_ADMIN_KEY.txt`
2. Use that key as admin (`scopes: admin,read,collect`).

## Create a website

```bash
curl -s -X POST "$PULSE/v1/websites" \
  -H "x-api-key: $ADMIN_KEY" \
  -H "content-type: application/json" \
  -d '{"name":"my-site","domain":"example.com","timezone":"Asia/Shanghai","withKeys":true}'
```

Response includes `website.publicId` (`ws_…`) and one-time plain keys (collect / read).

## Collect (browser-compatible, no key required)

```bash
curl -s -X POST "$PULSE/v1/collect" \
  -H "content-type: application/json" \
  -d '{
    "websiteId":"ws_xxx",
    "type":"pageview",
    "path":"/blog/hello",
    "visitorId":"v_demo",
    "sessionId":"s_demo"
  }'
```

Event:

```bash
curl -s -X POST "$PULSE/v1/collect" \
  -H "content-type: application/json" \
  -d '{
    "websiteId":"ws_xxx",
    "type":"event",
    "name":"quiz_complete",
    "path":"/blog/hello/result",
    "props":{"quizId":"abstract-mbti","typeId":"INTJ"},
    "visitorId":"v_demo"
  }'
```

## Query (requires `read` key)

```bash
# 7d stats
curl -s "$PULSE/v1/websites/$SITE_ID/stats" -H "x-api-key: $READ_KEY"

# path breakdown
curl -s "$PULSE/v1/websites/$SITE_ID/metrics?type=path" -H "x-api-key: $READ_KEY"

# event breakdown
curl -s "$PULSE/v1/websites/$SITE_ID/metrics?type=event" -H "x-api-key: $READ_KEY"

# social proof
curl -s "$PULSE/v1/websites/$SITE_ID/interest?pathPrefix=/blog/hello&days=7" \
  -H "x-api-key: $READ_KEY"
```

## Rich queries (read key)

```bash
# whole report: totals, daily series, comparison with the previous period, top panels, goals
curl -s "$PULSE/v1/websites/$SITE_ID/report?days=7&compare=prev" -H "x-api-key: $READ_KEY"

# any dimension: path | event | referrer | channel | utm_source | utm_medium | utm_campaign
#                country | browser | os | device | language
curl -s "$PULSE/v1/websites/$SITE_ID/breakdown?by=channel&days=30" -H "x-api-key: $READ_KEY"

# filters combine and apply everywhere (here: mobile visitors from social, last 7 days)
curl -s "$PULSE/v1/websites/$SITE_ID/report?days=7&device=mobile&channel=social" -H "x-api-key: $READ_KEY"

# goals and funnels
curl -s -X POST "$PULSE/v1/websites/$SITE_ID/goals" -H "x-api-key: $ADMIN_KEY" -H 'content-type: application/json' \
  -d '{"name":"Signup","type":"event","value":"signup"}'
curl -s -X POST "$PULSE/v1/websites/$SITE_ID/funnels" -H "x-api-key: $ADMIN_KEY" -H 'content-type: application/json' \
  -d '{"name":"Landing → Signup","steps":[{"type":"path","value":"/"},{"type":"event","value":"signup"}]}'
curl -s "$PULSE/v1/websites/$SITE_ID/funnels?days=30" -H "x-api-key: $READ_KEY"
```

## OpenAPI

`GET /v1/openapi.json`
