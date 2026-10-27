<script setup lang="ts">
import type { Dim } from '~/composables/useDim'

export interface BreakdownRow {
  x: string
  count: number
  visitors: number
}

const props = defineProps<{
  tabs: Dim[]
  /** Rows the report already returned, keyed by dimension. */
  seed: Partial<Record<Dim, BreakdownRow[]>>
  /** Fetch rows for one dimension under the current range/filters. */
  load: (by: Dim) => Promise<BreakdownRow[]>
  /** Bumps whenever range/filters change so cached tabs are dropped. */
  version: number
  /** Active filters, used to mark rows that are already applied. */
  active?: Partial<Record<string, string>>
}>()
const emit = defineEmits<{ pick: [by: Dim, value: string] }>()

const { t } = useI18n()
const { formatNum } = useFormat()
const { dimLabel, valueLabel, mono } = useDim()

const current = ref<Dim>(props.tabs[0]!)
const cache = ref<Partial<Record<Dim, BreakdownRow[]>>>({})
const loading = ref(false)
const failed = ref(false)

async function ensure(by: Dim) {
  if (cache.value[by])
    return
  loading.value = true
  failed.value = false
  try {
    cache.value = { ...cache.value, [by]: await props.load(by) }
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
}

watch(() => [props.version, props.seed], () => {
  cache.value = { ...props.seed }
  void ensure(current.value)
}, { immediate: true })

watch(current, by => void ensure(by))

const rows = computed(() => cache.value[current.value] || [])
const max = computed(() => Math.max(...rows.value.map(r => r.count), 1))
const countLabel = computed(() => current.value === 'event' ? t('site.count') : t('site.pv'))
</script>

<template>
  <section class="flex min-h-[15rem] flex-col rounded-lg border border-default bg-default">
    <header class="flex items-center justify-between gap-2 border-b border-default px-2 py-1.5">
      <div class="flex flex-wrap gap-0.5" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab"
          type="button"
          role="tab"
          :aria-selected="current === tab"
          class="family-action rounded-md px-2 py-0.5 text-xs font-medium"
          :class="current === tab ? 'bg-[var(--brand-wash)] text-[var(--brand)]' : 'text-muted hover:text-highlighted'"
          @click="current = tab"
        >
          {{ dimLabel(tab) }}
        </button>
      </div>
      <div class="flex shrink-0 gap-4 pr-1 text-[11px] font-semibold text-muted">
        <span>{{ countLabel }}</span>
        <span class="w-10 text-right">{{ $t('site.visitors') }}</span>
      </div>
    </header>

    <ul v-if="rows.length" class="py-1">
      <li v-for="r in rows" :key="r.x">
        <button
          type="button"
          class="relative flex h-7 w-full items-center gap-3 px-3 text-left text-[13px] hover:bg-elevated"
          :title="$t('site.filterBy', { value: valueLabel(current, r.x) })"
          @click="emit('pick', current, r.x)"
        >
          <span
            class="absolute inset-y-0.5 left-1 rounded bg-[var(--brand-wash)]"
            :style="{ width: `calc(${(r.count / max) * 100}% - 0.5rem)` }"
            aria-hidden="true"
          />
          <span
            class="relative min-w-0 flex-1 truncate text-highlighted"
            :class="[mono(current) ? 'font-mono-tight' : '', active?.[current] === r.x ? 'font-semibold text-[var(--brand)]' : '']"
          >{{ valueLabel(current, r.x) }}</span>
          <span class="num relative font-medium text-highlighted">{{ formatNum(r.count) }}</span>
          <span class="num relative w-10 text-right text-muted">{{ formatNum(r.visitors) }}</span>
        </button>
      </li>
    </ul>
    <p v-else-if="loading" class="px-3 py-8 text-center text-xs text-muted">
      {{ $t('app.loading') }}
    </p>
    <p v-else-if="failed" class="px-3 py-8 text-center text-xs text-[var(--pulse-down)]">
      {{ $t('errors.requestFailed') }}
    </p>
    <p v-else class="px-3 py-8 text-center text-xs text-muted">
      {{ $t('site.noData') }}
    </p>
  </section>
</template>
