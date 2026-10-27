import { openApiEn } from './openapiDoc.en'
import { PULSE_VERSION } from './version'

/** Canonical OpenAPI 3 document for Pulse (Chinese source text; `lang=en` swaps in English). */
export function getOpenApiDocument(baseUrl = '/', lang: 'zh' | 'en' = 'zh') {
  const doc = buildDocument(baseUrl)
  return lang === 'en' ? translate(doc) : doc
}

/** Deep-replace every string that has an English entry; anything else is left untouched. */
function translate<T>(value: T): T {
  if (typeof value === 'string')
    return (openApiEn[value] ?? value) as T
  if (Array.isArray(value))
    return value.map(translate) as T
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, translate(v)])) as T
  return value
}

function buildDocument(baseUrl: string) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Pulse Analytics API',
      version: PULSE_VERSION,
      description:
        '轻量产品埋点服务。API Key 一等公民，适合 Agent / 脚本 / 服务端。'
        + '浏览器采集可用 public websiteId；查询与管理需 x-api-key。',
    },
    servers: [{ url: baseUrl, description: 'Current host' }],
    tags: [
      { name: 'System', description: '健康检查与文档' },
      { name: 'Collect', description: '上报 pageview / event' },
      { name: 'Websites', description: '站点管理与查询' },
      { name: 'Reports', description: '报表、排行、目标与漏斗' },
      { name: 'Share', description: '只读分享链接' },
      { name: 'Keys', description: 'API Key 管理' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: '也可用 Authorization: Bearer <key>',
        },
      },
      schemas: {
        CollectBody: {
          type: 'object',
          required: ['websiteId', 'type'],
          properties: {
            websiteId: { type: 'string', description: '站点 publicId（ws_…）' },
            type: { type: 'string', enum: ['pageview', 'event'] },
            name: { type: 'string', description: 'event 名称' },
            path: { type: 'string' },
            url: { type: 'string' },
            referrer: { type: 'string' },
            props: { type: 'object', additionalProperties: true },
            sessionId: { type: 'string' },
            visitorId: { type: 'string' },
            ts: { type: 'integer' },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      '/v1/health': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          description: '无需鉴权。仅返回服务状态与版本。',
          security: [],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  example: { ok: true, service: 'pulse', version: PULSE_VERSION, ts: 1710000000000 },
                },
              },
            },
          },
        },
      },
      '/v1/openapi.json': {
        get: {
          tags: ['System'],
          summary: 'OpenAPI JSON',
          description: '机器可读规范。人类请看 /docs。',
          security: [],
          responses: { 200: { description: 'OpenAPI document' } },
        },
      },
      '/v1/collect': {
        post: {
          tags: ['Collect'],
          summary: '上报 pageview / event',
          description:
            '浏览器可仅传 websiteId（public id）。可用 text/plain JSON 避免 CORS 预检。Agent 可带 collect scope 的 API Key。',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CollectBody' },
                example: {
                  websiteId: 'ws_xxx',
                  type: 'event',
                  name: 'quiz_complete',
                  path: '/q/abstract-mbti/result',
                  props: { quizId: 'abstract-mbti', typeId: 'INTJ' },
                  visitorId: 'v_demo',
                  sessionId: 's_demo',
                },
              },
              'text/plain': {
                schema: { type: 'string' },
                example: '{"websiteId":"ws_xxx","type":"pageview","path":"/"}',
              },
            },
          },
          responses: {
            202: {
              description: 'Accepted',
              content: {
                'application/json': {
                  example: { ok: true, accepted: 1, id: 'ev_xxx' },
                },
              },
            },
          },
        },
      },
      '/v1/collect/batch': {
        post: {
          tags: ['Collect'],
          summary: '批量上报',
          description: '需要 collect scope。最多 100 条。',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: {
                  items: [
                    { websiteId: 'ws_xxx', type: 'pageview', path: '/' },
                    { websiteId: 'ws_xxx', type: 'event', name: 'quiz_start', path: '/q/x' },
                  ],
                },
              },
            },
          },
          responses: { 202: { description: 'Accepted' } },
        },
      },
      '/v1/websites': {
        get: {
          tags: ['Websites'],
          summary: '列出站点',
          description: '需要 read 或 admin。',
          responses: { 200: { description: 'OK' } },
        },
        post: {
          tags: ['Websites'],
          summary: '创建站点',
          description: '需要全局 admin（未绑定站点的 key）。withKeys=true 时返回 collect/read 明文 key（仅一次）。',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: { name: 'my-site', domain: 'example.com', withKeys: true },
              },
            },
          },
          responses: { 200: { description: 'Created' } },
        },
      },
      '/v1/overview': {
        get: {
          tags: ['Websites'],
          summary: '全部站点总览（管理台首页数据源）',
          description: '一次请求返回 key 可见的所有站点：1d/7d/30d 窗口与环比、近 14 天 PV 迷你曲线、近 5 分钟在线访客。需要 read。',
          responses: { 200: { description: 'OK' } },
        },
      },
      '/v1/websites/{id}/timeseries': {
        get: {
          tags: ['Websites'],
          summary: '按日时间序列',
          description: 'query: days、startDay/endDay 或 startAt/endAt（毫秒；默认近 30 天，最长 366 天）。返回站点时区下补零的每日 pageviews / events / visitors。',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'startAt', in: 'query', schema: { type: 'integer' } },
            { name: 'endAt', in: 'query', schema: { type: 'integer' } },
          ],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/v1/websites/{id}/stats': {
        get: {
          tags: ['Websites'],
          summary: '聚合统计',
          description: 'query: days（最近 N 个自然日）| startDay+endDay | startAt+endAt（毫秒）。默认近 7 天；支持全部筛选参数。',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'startAt', in: 'query', schema: { type: 'integer' } },
            { name: 'endAt', in: 'query', schema: { type: 'integer' } },
          ],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  example: { pageviews: 120, events: 40, visitors: 18, startAt: 0, endAt: 0 },
                },
              },
            },
          },
        },
      },
      '/v1/websites/{id}/overview': {
        get: {
          tags: ['Websites'],
          summary: '1d / 7d / 30d 总览 + 环比',
          description: '返回 current / previous / change，用于管理台卡片。时间窗为站点时区的自然日（0 点起算），非滚动 24h：d1=今日 00:00→now 对比昨日全天；d7/d30 含今日在内的 N 个自然日。',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/v1/websites/{id}/metrics': {
        get: {
          tags: ['Websites'],
          summary: '维度拆解',
          description: 'type=path | event | referrer',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['path', 'event', 'referrer'] } },
            { name: 'startAt', in: 'query', schema: { type: 'integer' } },
            { name: 'endAt', in: 'query', schema: { type: 'integer' } },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
          ],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/v1/websites/{id}/events': {
        get: {
          tags: ['Websites'],
          summary: '原始事件列表',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'name', in: 'query', schema: { type: 'string' } },
            { name: 'pathPrefix', in: 'query', schema: { type: 'string' } },
            { name: 'startAt', in: 'query', schema: { type: 'integer' } },
            { name: 'endAt', in: 'query', schema: { type: 'integer' } },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
          ],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/v1/websites/{id}/interest': {
        get: {
          tags: ['Websites'],
          summary: '社交证明 interest',
          description: 'pathPrefix 或 eventName + days（默认 7）。',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'pathPrefix', in: 'query', schema: { type: 'string' } },
            { name: 'eventName', in: 'query', schema: { type: 'string' } },
            { name: 'days', in: 'query', schema: { type: 'integer' } },
          ],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/v1/websites/{id}/keys': {
        get: {
          tags: ['Keys'],
          summary: '列出 Key（仅 prefix）',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' } },
        },
        post: {
          tags: ['Keys'],
          summary: '创建 Key',
          description: '明文 key 仅在响应中返回一次。scopes: collect | read | admin',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                example: { name: 'agent-read', scopes: ['read'] },
              },
            },
          },
          responses: { 200: { description: 'Created' } },
        },
      },
      '/v1/websites/{id}/report': {
        get: {
          tags: ['Reports'],
          summary: '一次返回整页报表',
          description: '总数、按日序列、可选对比（compare=prev|year）、页面/事件/来源/渠道排行与目标转化。所有筛选同时作用于每一部分。',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'compare', in: 'query', schema: { type: 'string', enum: ['prev', 'year'] } },
            { name: 'days', in: 'query', schema: { type: 'integer' }, description: '最近 N 个自然日（站点时区），优先于 startAt/endAt' },
            { name: 'startDay', in: 'query', schema: { type: 'string' }, description: 'YYYY-MM-DD（站点时区），与 endDay 一起使用' },
            { name: 'endDay', in: 'query', schema: { type: 'string' } },
            { name: 'path', in: 'query', schema: { type: 'string' }, description: '筛选：页面路径（结尾 * 表示前缀）' },
            { name: 'referrer', in: 'query', schema: { type: 'string' }, description: '筛选：来源主机' },
            { name: 'channel', in: 'query', schema: { type: 'string', enum: ['direct', 'organic_search', 'social', 'referral', 'email', 'paid', 'campaign'] } },
            { name: 'utm_source', in: 'query', schema: { type: 'string' } },
            { name: 'utm_medium', in: 'query', schema: { type: 'string' } },
            { name: 'utm_campaign', in: 'query', schema: { type: 'string' } },
            { name: 'country', in: 'query', schema: { type: 'string' }, description: 'ISO 3166-1 alpha-2' },
            { name: 'browser', in: 'query', schema: { type: 'string' } },
            { name: 'os', in: 'query', schema: { type: 'string' } },
            { name: 'device', in: 'query', schema: { type: 'string', enum: ['desktop', 'mobile', 'tablet'] } },
            { name: 'language', in: 'query', schema: { type: 'string' } },
            { name: 'event', in: 'query', schema: { type: 'string' }, description: '筛选：事件名' },
          ],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/v1/websites/{id}/breakdown': {
        get: {
          tags: ['Reports'],
          summary: '某一维度的排行',
          description: 'by = path | event | referrer | channel | utm_source | utm_medium | utm_campaign | country | browser | os | device | language。维度自身的筛选会被忽略。',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'by', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'days', in: 'query', schema: { type: 'integer' }, description: '最近 N 个自然日（站点时区），优先于 startAt/endAt' },
            { name: 'startDay', in: 'query', schema: { type: 'string' }, description: 'YYYY-MM-DD（站点时区），与 endDay 一起使用' },
            { name: 'endDay', in: 'query', schema: { type: 'string' } },
            { name: 'path', in: 'query', schema: { type: 'string' }, description: '筛选：页面路径（结尾 * 表示前缀）' },
            { name: 'referrer', in: 'query', schema: { type: 'string' }, description: '筛选：来源主机' },
            { name: 'channel', in: 'query', schema: { type: 'string', enum: ['direct', 'organic_search', 'social', 'referral', 'email', 'paid', 'campaign'] } },
            { name: 'utm_source', in: 'query', schema: { type: 'string' } },
            { name: 'utm_medium', in: 'query', schema: { type: 'string' } },
            { name: 'utm_campaign', in: 'query', schema: { type: 'string' } },
            { name: 'country', in: 'query', schema: { type: 'string' }, description: 'ISO 3166-1 alpha-2' },
            { name: 'browser', in: 'query', schema: { type: 'string' } },
            { name: 'os', in: 'query', schema: { type: 'string' } },
            { name: 'device', in: 'query', schema: { type: 'string', enum: ['desktop', 'mobile', 'tablet'] } },
            { name: 'language', in: 'query', schema: { type: 'string' } },
            { name: 'event', in: 'query', schema: { type: 'string' }, description: '筛选：事件名' },
          ],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/v1/websites/{id}/goals': {
        get: {
          tags: ['Reports'],
          summary: '目标及转化率',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'days', in: 'query', schema: { type: 'integer' } }],
          responses: { 200: { description: 'OK' } },
        },
        post: {
          tags: ['Reports'],
          summary: '创建目标（admin）',
          description: 'type=event：value 为事件名；type=path：value 以 / 开头，结尾 * 表示前缀。',
          requestBody: { required: true, content: { 'application/json': { example: { name: 'Signup', type: 'event', value: 'signup' } } } },
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Created' } },
        },
      },
      '/v1/websites/{id}/goals/{goalId}': {
        delete: {
          tags: ['Reports'],
          summary: '删除目标（admin）',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'goalId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/v1/websites/{id}/funnels': {
        get: {
          tags: ['Reports'],
          summary: '漏斗及各步骤访客数',
          description: '每一步必须在上一步之后 windowMinutes 分钟内完成；按访客计。',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'days', in: 'query', schema: { type: 'integer' } }],
          responses: { 200: { description: 'OK' } },
        },
        post: {
          tags: ['Reports'],
          summary: '创建漏斗（admin）',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: {
                  name: 'Landing → Signup',
                  steps: [{ type: 'path', value: '/lp' }, { type: 'event', value: 'signup' }],
                  windowMinutes: 1440,
                },
              },
            },
          },
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Created' } },
        },
      },
      '/v1/websites/{id}/funnels/{funnelId}': {
        delete: {
          tags: ['Reports'],
          summary: '删除漏斗（admin）',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'funnelId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/v1/websites/{id}': {
        get: {
          tags: ['Websites'],
          summary: '站点详情',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' } },
        },
        patch: {
          tags: ['Websites'],
          summary: '修改站点设置（admin）',
          description: 'name / domain / timezone（IANA，null=服务器时区）/ retentionDays（0=永久，null=服务器默认）。修改时区会按新时区重建全部历史聚合。',
          requestBody: { required: true, content: { 'application/json': { example: { timezone: 'Asia/Shanghai', retentionDays: 365 } } } },
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' } },
        },
        delete: {
          tags: ['Websites'],
          summary: '永久删除站点（全局 admin）',
          description: '连同全部事件、汇总、目标、漏斗与密钥一起删除，不可恢复。',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/v1/websites/{id}/prune': {
        post: {
          tags: ['Websites'],
          summary: '立即清理明细事件（admin）',
          description: '删除早于 days 天的原始事件与访客明细；每日汇总保留。缺省使用站点保留天数（或 PULSE_RETENTION_DAYS）。',
          requestBody: { content: { 'application/json': { example: { days: 365 } } } },
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/v1/websites/{id}/share': {
        post: {
          tags: ['Share'],
          summary: '创建/重置只读分享链接（admin）',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK', content: { 'application/json': { example: { shareId: 'k3j…', path: '/share/k3j…' } } } } },
        },
        delete: {
          tags: ['Share'],
          summary: '停止分享（admin）',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/v1/share/{shareId}/report': {
        get: {
          tags: ['Share'],
          summary: '公开只读报表',
          description: '无需 key，凭分享链接 token 访问；参数同 /v1/websites/{id}/report，仅返回站点名称、域名与时区。另有 /breakdown、/funnels。',
          security: [],
          parameters: [{ name: 'shareId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/v1/keys/{id}': {
        delete: {
          tags: ['Keys'],
          summary: '吊销 Key',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Revoked' } },
        },
      },
    },
  }
}
