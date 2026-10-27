<script setup lang="ts">
export interface GoalRow {
  id: string
  name: string
  type: 'path' | 'event'
  value: string
  conversions: number
  visitors: number
  rate: number
}

const props = defineProps<{ goals: GoalRow[], readonly?: boolean }>()
const emit = defineEmits<{
  create: [goal: { name: string, type: 'path' | 'event', value: string }]
  remove: [id: string]
}>()

const { t } = useI18n()
const { formatNum } = useFormat()

const adding = ref(false)
const name = ref('')
const type = ref<'path' | 'event'>('event')
const value = ref('')

const typeItems = computed(() => [
  { label: t('goals.typeEvent'), value: 'event' as const },
  { label: t('goals.typePath'), value: 'path' as const },
])
const valid = computed(() => !!name.value.trim() && !!value.value.trim() && (type.value === 'event' || value.value.trim().startsWith('/')))

function submit() {
  if (!valid.value)
    return
  emit('create', { name: name.value.trim(), type: type.value, value: value.value.trim() })
  name.value = ''
  value.value = ''
  adding.value = false
}

function pct(r: number) {
  return `${(Math.round(r * 1000) / 10).toString()}%`
}
const maxRate = computed(() => Math.max(...props.goals.map(g => g.rate), 0.0001))
</script>

<template>
  <section class="rounded-lg border border-default bg-default">
    <header class="flex items-center justify-between border-b border-default px-3 py-1.5">
      <h2 class="text-xs font-semibold text-highlighted">
        {{ $t('goals.title') }}
      </h2>
      <UButton v-if="!readonly" size="xs" variant="soft" color="neutral" icon="i-lucide-plus" @click="adding = !adding">
        {{ $t('goals.add') }}
      </UButton>
    </header>

    <form v-if="adding" class="grid gap-2 border-b border-default bg-elevated/50 p-3 sm:grid-cols-[1fr_8rem_1fr_auto]" @submit.prevent="submit">
      <UInput v-model="name" size="sm" :placeholder="$t('goals.namePlaceholder')" :aria-label="$t('goals.name')" />
      <USelect v-model="type" size="sm" :items="typeItems" :aria-label="$t('goals.type')" />
      <UInput
        v-model="value"
        size="sm"
        :placeholder="type === 'event' ? 'signup' : $t('goals.pathPlaceholder')"
        :aria-label="$t('goals.value')"
        class="font-mono-tight"
      />
      <UButton type="submit" size="sm" color="primary" :disabled="!valid">
        {{ $t('goals.save') }}
      </UButton>
    </form>

    <ul v-if="goals.length" class="divide-y divide-default">
      <li v-for="g in goals" :key="g.id" class="group relative px-3 py-2">
        <div class="flex items-baseline justify-between gap-3">
          <div class="min-w-0">
            <span class="text-[13px] font-medium text-highlighted">{{ g.name }}</span>
            <span class="font-mono-tight ml-2 text-[11px] text-muted">{{ g.type === 'event' ? '⚡' : '↗' }} {{ g.value }}</span>
          </div>
          <div class="flex shrink-0 items-baseline gap-3">
            <span class="num text-xs text-muted">{{ formatNum(g.visitors) }} {{ $t('metric.visitors') }}</span>
            <span class="num text-sm font-semibold text-highlighted">{{ pct(g.rate) }}</span>
            <UButton
              v-if="!readonly"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-trash-2"
              :aria-label="$t('goals.remove')"
              class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              @click="emit('remove', g.id)"
            />
          </div>
        </div>
        <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated">
          <div class="h-full rounded-full bg-[var(--brand)]" :style="{ width: `${(g.rate / maxRate) * 100}%` }" />
        </div>
      </li>
    </ul>
    <p v-else class="px-3 py-6 text-center text-xs text-muted">
      {{ readonly ? $t('goals.empty') : $t('goals.emptyHint') }}
    </p>
  </section>
</template>
