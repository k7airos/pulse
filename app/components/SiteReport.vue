<script setup lang="ts">
import type { BreakdownRow } from '~/components/BreakdownCard.vue'
import type { FunnelRow } from '~/components/FunnelsPanel.vue'
import type { GoalRow } from '~/components/GoalsPanel.vue'
import type { TrendPoint } from '~/components/TrendChart.vue'
import type { Dim } from '~/composables/useDim'

interface Totals { pageviews: number, events: number, visitors: number }
interface Report {
  website: { name: string, domain: string | null, tz: string }
  range: { startDay: string, endDay: string, tz: string }
  filters: Record<string, string>
  totals: Totals
  series: TrendPoint[]
  compare: null | {
    mode: 'prev' | 'year'
    startDay: string
    endDay: string
    totals: Totals
    series: TrendPoint[]
    change: { pageviews: number | null, events: number | null, visitors: number | null }
  }
  panels: Partial<Record<Dim, BreakdownRow[]>>
  goals: GoalRow[]
}

const props = defineProps<{ mode: 'admin' | 'share', siteId?: string, shareId?: string }>()
const emit = defineEmits<{ loaded: [report: Report] }>()

const { t } = useI18n()
const toast = useToast()
const { formatNum } = useFormat()
const { dimLabel, valueLabel } = useDim()
const { api, error } = usePulseAdmin()
const { describeError } = useApiError()

type Period = 'd1' | 'd7' | 'd30' | 'd90' | 'custom'
type Compare = 'none' | 'prev' | 'year'

const period = ref<Period>('d7')
const customFrom = ref('')
const customTo = ref('')
const compare = ref<Compare>('prev')
const filters = ref<Record<string, string>>({})

const report = ref<Report | null>(null)
const funnels = ref<FunnelRow[]>([])
const loading = ref(false)
const failure = ref('')
const version = ref(0)

const readonly = computed(() => props.mode === 'share')

const periodItems = computed(() => [
  { label: t('period.short_d1'), value: 'd1' as const },
  { label: t('period.short_d7'), value: 'd7' as const },
  { label: t('period.short_d30'), value: 'd30' as const },
  { label: t('period.short_d90'), value: 'd90' as const },
  { label: t('period.custom'), value: 'custom' as const },
])
const compareItems = computed(() => [
  { label: t('compare.none'), value: 'none' as const },
  { label: t('compare.prev'), value: 'prev' as const },
  { label: t('compare.year'), value: 'year' as const },
])

const rangeQuery = computed<Record<string, string | number>>(() => {
  if (period.value === 'custom')
    return { startDay: customFrom.value, endDay: customTo.value }
  return { days: Number(period.value.slice(1)) }
})
const customReady = computed(() => period.value !== 'custom' || (!!customFrom.value && !!customTo.value && customFrom.value <= customTo.value))
const baseQuery = computed(() => ({ ...rangeQuery.value, ...filters.value }))

function qs(q: Record<string, string | number | undefined>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== '')
      p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

/** Same JSON from either an API key (admin) or a share link (public). */
function get<T>(path: string, q: Record<string, string | number | undefined>): Promise<T> {
  if (props.mode === 'share')
    return $fetch<T>(`/v1/share/${props.shareId}${path}${qs(q)}`)
  return api<T>(`/v1/websites/${props.siteId}${path}${qs(q)}`)
}

let seq = 0
async function load() {
  if (!customReady.value)
    return
  const mine = ++seq
  loading.value = true
  failure.value = ''
  try {
    const q = { ...baseQuery.value, compare: compare.value === 'none' ? undefined : compare.value }
    const r = await get<Report>('/report', q)
    if (mine !== seq)
      return
    report.value = r
    version.value++
    emit('loaded', r)
    void loadFunnels(mine)
  }
  catch (e) {
    if (mine === seq)
      failure.value = describeError(e)
  }
  finally {
    if (mine === seq)
      loading.value = false
  }
}

async function loadFunnels(mine: number) {
  try {
    const f = await get<{ funnels: FunnelRow[] }>('/funnels', baseQuery.value)
    if (mine === seq)
      funnels.value = f.funnels
  }
  catch { /* funnels are optional; the report already rendered */ }
}

function loadBreakdown(by: Dim) {
  return get<{ rows: BreakdownRow[] }>('/breakdown', { ...baseQuery.value, by, limit: 10 }).then(r => r.rows)
}

// 点击排行里的一行 = 给整页加筛选；再点同一项会取消
function pick(by: Dim, value: string) {
  const next = { ...filters.value }
  if (next[by] === value)
    delete next[by]
  else
    next[by] = value
  filters.value = next
}
function removeFilter(k: string) {
  const next = { ...filters.value }
  delete next[k]
  filters.value = next
}
const filterChips = computed(() => Object.entries(filters.value).map(([k, v]) => ({ key: k, label: `${dimLabel(k)}: ${valueLabel(k, v)}` })))

watch([period, customFrom, customTo, compare, filters], () => void load(), { deep: true })
onMounted(() => void load())

// ——— 目标 / 漏斗（仅管理端可写）———
async function mutate(path: string, method: 'POST' | 'DELETE', body?: unknown) {
  try {
    await api(`/v1/websites/${props.siteId}${path}`, { method, body: body as Record<string, unknown> })
    await load()
  }
  catch {
    toast.add({ title: t('dashboard.createFail'), description: error.value || t('dashboard.retry'), color: 'error' })
  }
}

// ——— 展示 ———
const kpis = computed(() => {
  const r = report.value
  const c = r?.compare
  return [
    { key: 'pageviews', label: t('metric.pageviews'), value: r?.totals.pageviews, change: c?.change.pageviews, prev: c?.totals.pageviews },
    { key: 'visitors', label: t('metric.visitors'), value: r?.totals.visitors, change: c?.change.visitors, prev: c?.totals.visitors },
    { key: 'events', label: t('metric.events'), value: r?.totals.events, change: c?.change.events, prev: c?.totals.events },
  ]
})

const rangeLabel = computed(() => {
  const r = report.value?.range
  if (!r)
    return ''
  return r.startDay === r.endDay ? r.startDay : `${r.startDay} → ${r.endDay}`
})
const compareLabel = computed(() => {
  const c = report.value?.compare
  return c ? `${t(`compare.${c.mode}`)} · ${c.startDay} → ${c.endDay}` : ''
})

defineExpose({ reload: load })
</script>

<template>
  <div class="space-y-3">
    <!-- 工具栏 -->
    <div class="flex flex-wrap items-center gap-2">
      <UTabs v-model="period" :items="periodItems" :content="false" size="xs" variant="pill" class="w-auto" />
      <template v-if="period === 'custom'">
        <UInput v-model="customFrom" type="date" size="sm" class="w-36" :aria-label="$t('period.from')" />
        <span class="text-xs text-muted">→</span>
        <UInput v-model="customTo" type="date" size="sm" class="w-36" :aria-label="$t('period.to')" />
      </template>
      <USelect v-model="compare" :items="compareItems" size="sm" class="w-36" :aria-label="$t('compare.label')" />
      <span class="num hidden text-xs text-muted md:inline">{{ rangeLabel }}</span>
      <UButton
        class="ml-auto"
        variant="outline"
        color="neutral"
        icon="i-lucide-refresh-cw"
        :loading="loading"
        :aria-label="$t('nav.refresh')"
        @click="load()"
      />
    </div>

    <!-- 已应用的筛选 -->
    <div v-if="filterChips.length" class="flex flex-wrap items-center gap-1.5" :aria-label="$t('filters.active')">
      <span class="text-xs text-muted">{{ $t('filters.active') }}</span>
      <button
        v-for="c in filterChips"
        :key="c.key"
        type="button"
        class="family-action inline-flex items-center gap-1 rounded-full bg-[var(--brand-wash)] px-2.5 py-0.5 text-xs font-medium text-[var(--brand)]"
        :title="$t('filters.remove')"
        @click="removeFilter(c.key)"
      >
        {{ c.label }}
        <UIcon name="i-lucide-x" class="size-3" />
      </button>
      <UButton size="xs" variant="link" color="neutral" @click="filters = {}">
        {{ $t('filters.clear') }}
      </UButton>
    </div>

    <UAlert v-if="failure" color="error" variant="subtle" :title="failure" />

    <template v-if="report">
      <!-- KPI + 趋势 -->
      <section class="overflow-hidden rounded-lg border border-default bg-default" :class="loading ? 'opacity-70 transition-opacity' : ''">
        <div class="grid grid-cols-3 divide-x divide-default border-b border-default">
          <div v-for="k in kpis" :key="k.key" class="px-3 py-2">
            <div class="flex items-center justify-between gap-2 text-[11px] font-medium text-muted">
              {{ k.label }}
              <DeltaChip v-if="report.compare" :change="k.change" />
            </div>
            <div class="flex items-baseline gap-2">
              <span class="num text-xl font-semibold leading-7 text-highlighted">{{ formatNum(k.value) }}</span>
              <span v-if="report.compare" class="num text-[11px] text-muted">{{ formatNum(k.prev) }}</span>
            </div>
          </div>
        </div>
        <div class="px-3 pb-2 pt-2">
          <div class="mb-1 flex flex-wrap items-center justify-between gap-x-4 text-[11px] text-muted">
            <span>{{ $t('site.trend') }}</span>
            <span class="flex flex-wrap items-center gap-3">
              <span class="flex items-center gap-1"><i class="inline-block h-2 w-2 rounded-sm bg-[var(--brand)]" />{{ $t('metric.pageviews') }}</span>
              <span class="flex items-center gap-1"><i class="inline-block h-0.5 w-3 bg-[var(--family-text)] opacity-60" />{{ $t('metric.visitors') }}</span>
              <span v-if="report.compare" class="flex items-center gap-1">
                <i class="inline-block h-0 w-3 border-t-[1.5px] border-dashed border-[var(--family-text-muted)]" />{{ compareLabel }}
              </span>
            </span>
          </div>
          <TrendChart :points="report.series" :compare="report.compare?.series" :height="150" />
        </div>
      </section>

      <!-- 排行：点击任意一行即作为全局筛选 -->
      <div class="grid gap-3 lg:grid-cols-2">
        <BreakdownCard
          :tabs="['path', 'event']"
          :seed="report.panels"
          :load="loadBreakdown"
          :version="version"
          :active="filters"
          @pick="pick"
        />
        <BreakdownCard
          :tabs="['referrer', 'channel', 'utm_source', 'utm_medium', 'utm_campaign']"
          :seed="report.panels"
          :load="loadBreakdown"
          :version="version"
          :active="filters"
          @pick="pick"
        />
        <BreakdownCard
          :tabs="['browser', 'os', 'device']"
          :seed="report.panels"
          :load="loadBreakdown"
          :version="version"
          :active="filters"
          @pick="pick"
        />
        <BreakdownCard
          :tabs="['country', 'language']"
          :seed="report.panels"
          :load="loadBreakdown"
          :version="version"
          :active="filters"
          @pick="pick"
        />
      </div>

      <!-- 目标 + 漏斗 -->
      <div class="grid items-start gap-3 lg:grid-cols-2">
        <GoalsPanel
          :goals="report.goals"
          :readonly="readonly"
          @create="g => mutate('/goals', 'POST', g)"
          @remove="id => mutate(`/goals/${id}`, 'DELETE')"
        />
        <FunnelsPanel
          :funnels="funnels"
          :readonly="readonly"
          @create="f => mutate('/funnels', 'POST', f)"
          @remove="id => mutate(`/funnels/${id}`, 'DELETE')"
        />
      </div>
    </template>

    <div v-else-if="loading" class="py-20 text-center text-xs text-muted">
      {{ $t('app.loading') }}
    </div>
  </div>
</template>
