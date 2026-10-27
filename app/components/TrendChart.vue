<script setup lang="ts">
export interface TrendPoint {
  day: string
  pageviews: number
  visitors: number
  events: number
}

const props = defineProps<{
  points: TrendPoint[]
  /** Same-length series of the comparison period (drawn as a dashed line). */
  compare?: TrendPoint[] | null
  height?: number
}>()
const { t } = useI18n()
const { formatNum } = useFormat()

const W = 800
const H = computed(() => props.height ?? 160)
const PAD = { l: 4, r: 4, t: 8, b: 18 }

const max = computed(() => Math.max(
  ...props.points.map(p => p.pageviews),
  ...(props.compare || []).map(p => p.pageviews),
  1,
))
const slot = computed(() => (W - PAD.l - PAD.r) / Math.max(props.points.length, 1))
const bw = computed(() => Math.max(Math.min(slot.value - 2, 28), 1))
const plotH = computed(() => H.value - PAD.t - PAD.b)

function barY(v: number) {
  return PAD.t + plotH.value - (Math.min(v, max.value) / max.value) * plotH.value
}
function cx(i: number) {
  return PAD.l + slot.value * i + slot.value / 2
}

const uvLine = computed(() => props.points.map((p, i) => `${cx(i).toFixed(1)},${barY(p.visitors).toFixed(1)}`).join(' '))
const cmpLine = computed(() =>
  (props.compare || []).slice(0, props.points.length).map((p, i) => `${cx(i).toFixed(1)},${barY(p.pageviews).toFixed(1)}`).join(' '),
)

const hover = ref<number | null>(null)
const hp = computed(() => hover.value === null ? null : props.points[hover.value])
const hc = computed(() => hover.value === null ? null : props.compare?.[hover.value] || null)

// 横轴只标 4–6 个日期，避免挤压
const ticks = computed(() => {
  const n = props.points.length
  if (!n)
    return []
  const step = Math.max(Math.ceil(n / 6), 1)
  return props.points.map((p, i) => ({ i, label: p.day.slice(5) })).filter(x => x.i % step === 0)
})
</script>

<template>
  <div class="relative">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      preserveAspectRatio="none"
      class="block w-full"
      :style="{ height: `${H}px` }"
      role="img"
      :aria-label="t('site.trendAria')"
      @mouseleave="hover = null"
    >
      <line
        v-for="g in [0, 0.5, 1]"
        :key="g"
        :x1="PAD.l"
        :x2="W - PAD.r"
        :y1="PAD.t + plotH * g"
        :y2="PAD.t + plotH * g"
        stroke="var(--family-border)"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
        :stroke-dasharray="g === 1 ? '' : '3 4'"
      />
      <g v-for="(p, i) in points" :key="p.day">
        <rect
          :x="PAD.l + slot * i + (slot - bw) / 2"
          :y="barY(p.pageviews)"
          :width="bw"
          :height="Math.max(PAD.t + plotH - barY(p.pageviews), p.pageviews ? 1 : 0)"
          rx="1.5"
          fill="var(--brand)"
          :opacity="hover === null || hover === i ? 0.9 : 0.35"
        />
        <rect
          :x="PAD.l + slot * i"
          :y="0"
          :width="slot"
          :height="H"
          fill="transparent"
          @mouseenter="hover = i"
          @focus="hover = i"
        />
      </g>
      <polyline
        v-if="compare && compare.length > 1"
        :points="cmpLine"
        fill="none"
        stroke="var(--family-text-muted)"
        stroke-width="1.5"
        stroke-dasharray="4 3"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
      <polyline
        v-if="points.length > 1"
        :points="uvLine"
        fill="none"
        stroke="var(--family-text)"
        stroke-width="1.5"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
        opacity="0.55"
      />
    </svg>
    <div class="pointer-events-none relative mt-0.5 h-3.5 text-[10px] text-muted">
      <span
        v-for="tk in ticks"
        :key="tk.i"
        class="num absolute -translate-x-1/2"
        :style="{ left: `${(cx(tk.i) / W) * 100}%` }"
      >{{ tk.label }}</span>
    </div>
    <div
      v-if="hp"
      class="pointer-events-none absolute top-1 z-10 rounded-md border border-default bg-default px-2 py-1 text-[11px] shadow-[var(--family-shadow-panel)]"
      :style="{ left: `clamp(0px, calc(${((cx(hover!) / W) * 100).toFixed(1)}% - 70px), calc(100% - 190px))` }"
    >
      <div class="num font-medium text-highlighted">
        {{ hp.day }}
      </div>
      <div class="num text-muted">
        {{ t('metric.pageviews') }} <b class="text-highlighted">{{ formatNum(hp.pageviews) }}</b>
        · {{ t('metric.visitors') }} <b class="text-highlighted">{{ formatNum(hp.visitors) }}</b>
        · {{ t('metric.events') }} <b class="text-highlighted">{{ formatNum(hp.events) }}</b>
      </div>
      <div v-if="hc" class="num text-muted">
        {{ hc.day }} · {{ t('metric.pageviews') }} <b class="text-highlighted">{{ formatNum(hc.pageviews) }}</b>
      </div>
    </div>
  </div>
</template>
