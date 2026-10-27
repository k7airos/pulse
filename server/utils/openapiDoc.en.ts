/** English text for the OpenAPI document; keys are the exact Chinese source strings. */
export const openApiEn: Record<string, string> = {
  '轻量产品埋点服务。API Key 一等公民，适合 Agent / 脚本 / 服务端。浏览器采集可用 public websiteId；查询与管理需 x-api-key。':
    'Lightweight product analytics. API keys are first-class, which suits agents, scripts and servers. Browsers can collect with the public websiteId; querying and management need an x-api-key.',
  '健康检查与文档': 'Health check and docs',
  '上报 pageview / event': 'Ingest pageviews and events',
  '站点管理与查询': 'Website management and queries',
  '报表、排行、目标与漏斗': 'Reports, rankings, goals and funnels',
  '只读分享链接': 'Read-only share links',
  'API Key 管理': 'API key management',
  '也可用 Authorization: Bearer <key>': 'Authorization: Bearer <key> also works',
  '站点 publicId（ws_…）': 'Website publicId (ws_…)',
  'event 名称': 'Event name',
  '无需鉴权。仅返回服务状态与版本。': 'No auth. Returns only service status and version.',
  '机器可读规范。人类请看 /docs。': 'Machine-readable spec. Humans: see /docs.',
  '浏览器可仅传 websiteId（public id）。可用 text/plain JSON 避免 CORS 预检。Agent 可带 collect scope 的 API Key。':
    'Browsers only need the websiteId (public id). Send text/plain JSON to avoid a CORS preflight. Agents can use an API key with the collect scope.',
  '批量上报': 'Batch ingest',
  '需要 collect scope。最多 100 条。': 'Requires the collect scope. Up to 100 items.',
  '列出站点': 'List websites',
  '需要 read 或 admin。': 'Requires read or admin.',
  '创建站点': 'Create a website',
  '需要全局 admin（未绑定站点的 key）。withKeys=true 时返回 collect/read 明文 key（仅一次）。':
    'Requires a global admin key (not bound to a website). With withKeys=true the plain collect/read keys are returned once.',
  '全部站点总览（管理台首页数据源）': 'Overview of all websites (dashboard data source)',
  '一次请求返回 key 可见的所有站点：1d/7d/30d 窗口与环比、近 14 天 PV 迷你曲线、近 5 分钟在线访客。需要 read。':
    'Returns every website the key can see in one request: 1d/7d/30d windows with period-over-period change, a 14-day pageview sparkline and visitors online in the last 5 minutes. Requires read.',
  '按日时间序列': 'Daily time series',
  'query: days、startDay/endDay 或 startAt/endAt（毫秒；默认近 30 天，最长 366 天）。返回站点时区下补零的每日 pageviews / events / visitors。':
    'Query: days, startDay/endDay or startAt/endAt (ms; default last 30 days, max 366). Returns zero-filled daily pageviews / events / visitors in the website timezone.',
  '聚合统计': 'Aggregate stats',
  'query: days（最近 N 个自然日）| startDay+endDay | startAt+endAt（毫秒）。默认近 7 天；支持全部筛选参数。':
    'Query: days (last N calendar days) | startDay+endDay | startAt+endAt (ms). Defaults to the last 7 days; all filters are supported.',
  '1d / 7d / 30d 总览 + 环比': '1d / 7d / 30d overview with change vs previous period',
  '返回 current / previous / change，用于管理台卡片。时间窗为站点时区的自然日（0 点起算），非滚动 24h：d1=今日 00:00→now 对比昨日全天；d7/d30 含今日在内的 N 个自然日。':
    'Returns current / previous / change for dashboard cards. Windows are calendar days in the website timezone, not rolling 24h: d1 = today 00:00→now vs all of yesterday; d7/d30 = N calendar days including today.',
  '维度拆解': 'Dimension breakdown',
  '原始事件列表': 'Raw event list',
  '社交证明 interest': 'Social-proof interest',
  'pathPrefix 或 eventName + days（默认 7）。': 'pathPrefix or eventName, plus days (default 7).',
  '列出 Key（仅 prefix）': 'List keys (prefix only)',
  '创建 Key': 'Create a key',
  '明文 key 仅在响应中返回一次。scopes: collect | read | admin': 'The plain key is returned only once in the response. scopes: collect | read | admin',
  '一次返回整页报表': 'Whole report in one call',
  '总数、按日序列、可选对比（compare=prev|year）、页面/事件/来源/渠道排行与目标转化。所有筛选同时作用于每一部分。':
    'Totals, daily series, optional comparison (compare=prev|year), top pages / events / referrers / channels and goal conversions. Every filter applies to every part.',
  '最近 N 个自然日（站点时区），优先于 startAt/endAt': 'Last N calendar days (website timezone); takes precedence over startAt/endAt',
  'YYYY-MM-DD（站点时区），与 endDay 一起使用': 'YYYY-MM-DD (website timezone); use together with endDay',
  '筛选：页面路径（结尾 * 表示前缀）': 'Filter: page path (a trailing * means prefix)',
  '筛选：来源主机': 'Filter: referrer host',
  '筛选：事件名': 'Filter: event name',
  '某一维度的排行': 'Ranking for one dimension',
  'by = path | event | referrer | channel | utm_source | utm_medium | utm_campaign | country | browser | os | device | language。维度自身的筛选会被忽略。':
    'by = path | event | referrer | channel | utm_source | utm_medium | utm_campaign | country | browser | os | device | language. A filter on the dimension itself is ignored.',
  '目标及转化率': 'Goals and conversion rates',
  '创建目标（admin）': 'Create a goal (admin)',
  'type=event：value 为事件名；type=path：value 以 / 开头，结尾 * 表示前缀。':
    'type=event: value is the event name; type=path: value starts with / and a trailing * means prefix.',
  '删除目标（admin）': 'Delete a goal (admin)',
  '漏斗及各步骤访客数': 'Funnels with visitors per step',
  '每一步必须在上一步之后 windowMinutes 分钟内完成；按访客计。':
    'Each step must happen within windowMinutes of the previous one; counted per visitor.',
  '创建漏斗（admin）': 'Create a funnel (admin)',
  '删除漏斗（admin）': 'Delete a funnel (admin)',
  '站点详情': 'Website details',
  '修改站点设置（admin）': 'Update website settings (admin)',
  'name / domain / timezone（IANA，null=服务器时区）/ retentionDays（0=永久，null=服务器默认）。修改时区会按新时区重建全部历史聚合。':
    'name / domain / timezone (IANA; null = server timezone) / retentionDays (0 = forever; null = server default). Changing the timezone rebuilds all historical rollups in the new zone.',
  '永久删除站点（全局 admin）': 'Permanently delete a website (global admin)',
  '连同全部事件、汇总、目标、漏斗与密钥一起删除，不可恢复。':
    'Deletes all events, rollups, goals, funnels and keys with it. Irreversible.',
  '立即清理明细事件（admin）': 'Clean up raw events now (admin)',
  '删除早于 days 天的原始事件与访客明细；每日汇总保留。缺省使用站点保留天数（或 PULSE_RETENTION_DAYS）。':
    'Deletes raw events and visitor rows older than `days`; daily totals are kept. Defaults to the website retention (or PULSE_RETENTION_DAYS).',
  '创建/重置只读分享链接（admin）': 'Create or rotate the read-only share link (admin)',
  '停止分享（admin）': 'Stop sharing (admin)',
  '公开只读报表': 'Public read-only report',
  '无需 key，凭分享链接 token 访问；参数同 /v1/websites/{id}/report，仅返回站点名称、域名与时区。另有 /breakdown、/funnels。':
    'No key needed; access with the share token. Same parameters as /v1/websites/{id}/report; returns only the website name, domain and timezone. Also /breakdown and /funnels.',
  '吊销 Key': 'Revoke a key',
}
