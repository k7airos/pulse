<script setup lang="ts">
export interface FunnelStepResult {
  type: 'path' | 'event'
  value: string
  visitors: number
  fromPrevious: number
  fromFirst: number
}
export interface FunnelRow {
  id: string
  name: string
  windowMinutes: number
  result: { truncated: boolean, steps: FunnelStepResult[] }
}

defineProps<{ funnels: FunnelRow[], readonly?: boolean }>()
const emit = defineEmits<{
  create: [funnel: { name: string, steps: Array<{ type: 'path' | 'event', value: string }>, windowMinutes: number }]
  remove: [id: string]
}>()

const { t } = useI18n()
const { formatNum } = useFormat()

const open = ref(false)
const name = ref('')
const windowMinutes = ref(1440)
const steps = ref<Array<{ type: 'path' | 'event', value: string }>>([
  { type: 'path', value: '' },
  { type: 'event', value: '' },
])

const typeItems = computed(() => [
  { label: t('goals.typePath'), value: 'path' as const },
  { label: t('goals.typeEvent'), value: 'event' as const },
])
const windowItems = computed(() => [
  { label: t('funnels.win30m'), value: 30 },
  { label: t('funnels.win1d'), value: 1440 },
  { label: t('funnels.win7d'), value: 10080 },
])

const valid = computed(() =>
  !!name.value.trim()
  && steps.value.length >= 2
  && steps.value.every(s => s.value.trim() && (s.type === 'event' || s.value.trim().startsWith('/'))),
)

function addStep() {
  if (steps.value.length < 8)
    steps.value.push({ type: 'path', value: '' })
}
function removeStep(i: number) {
  if (steps.value.length > 2)
    steps.value.splice(i, 1)
}
function submit() {
  if (!valid.value)
    return
  emit('create', {
    name: name.value.trim(),
    steps: steps.value.map(s => ({ type: s.type, value: s.value.trim() })),
    windowMinutes: windowMinutes.value,
  })
  open.value = false
  name.value = ''
  steps.value = [{ type: 'path', value: '' }, { type: 'event', value: '' }]
}

function pct(r: number) {
  return `${Math.round(r * 1000) / 10}%`
}
</script>

<template>
  <section class="rounded-lg border border-default bg-default">
    <header class="flex items-center justify-between border-b border-default px-3 py-1.5">
      <h2 class="text-xs font-semibold text-highlighted">
        {{ $t('funnels.title') }}
      </h2>
      <UButton v-if="!readonly" size="xs" variant="soft" color="neutral" icon="i-lucide-plus" @click="open = true">
        {{ $t('funnels.add') }}
      </UButton>
    </header>

    <div v-if="funnels.length" class="divide-y divide-default">
      <article v-for="f in funnels" :key="f.id" class="group px-3 py-2.5">
        <div class="mb-2 flex items-center justify-between gap-2">
          <h3 class="text-[13px] font-medium text-highlighted">
            {{ f.name }}
            <span class="ml-1 text-[11px] font-normal text-muted">· {{ $t('funnels.within', { n: f.windowMinutes >= 1440 ? `${f.windowMinutes / 1440} ${$t('funnels.days')}` : `${f.windowMinutes} ${$t('funnels.minutes')}` }) }}</span>
          </h3>
          <UButton
            v-if="!readonly"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-trash-2"
            :aria-label="$t('goals.remove')"
            class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            @click="emit('remove', f.id)"
          />
        </div>
        <ol class="space-y-1">
          <li v-for="(s, i) in f.result.steps" :key="i" class="relative flex h-7 items-center gap-2 overflow-hidden rounded px-2 text-[13px]">
            <span
              class="absolute inset-y-0 left-0 rounded bg-[var(--brand-wash)]"
              :style="{ width: `${Math.max(s.fromFirst * 100, s.visitors ? 1.5 : 0)}%` }"
              aria-hidden="true"
            />
            <span class="num relative grid size-4 shrink-0 place-items-center rounded-full bg-default text-[10px] font-bold text-muted">{{ i + 1 }}</span>
            <span class="font-mono-tight relative min-w-0 flex-1 truncate text-highlighted">{{ s.type === 'event' ? '⚡' : '↗' }} {{ s.value }}</span>
            <span class="num relative font-semibold text-highlighted">{{ formatNum(s.visitors) }}</span>
            <span class="num relative w-24 text-right text-[11px] text-muted">
              <template v-if="i === 0">100%</template>
              <template v-else>{{ pct(s.fromFirst) }} <span class="text-[var(--pulse-down)]">−{{ pct(1 - s.fromPrevious) }}</span></template>
            </span>
          </li>
        </ol>
        <p v-if="f.result.truncated" class="mt-1 text-[11px] text-muted">
          {{ $t('funnels.truncated') }}
        </p>
      </article>
    </div>
    <p v-else class="px-3 py-6 text-center text-xs text-muted">
      {{ readonly ? $t('funnels.empty') : $t('funnels.emptyHint') }}
    </p>

    <UModal v-model:open="open" :title="$t('funnels.createTitle')" :description="$t('funnels.createDesc')">
      <template #body>
        <form class="space-y-3" @submit.prevent="submit">
          <UFormField :label="$t('goals.name')" required>
            <UInput v-model="name" class="w-full" :placeholder="$t('funnels.namePlaceholder')" autofocus />
          </UFormField>
          <UFormField :label="$t('funnels.steps')" required>
            <div class="space-y-1.5">
              <div v-for="(s, i) in steps" :key="i" class="grid grid-cols-[1.25rem_7rem_1fr_auto] items-center gap-1.5">
                <span class="num text-center text-[11px] font-bold text-muted">{{ i + 1 }}</span>
                <USelect v-model="s.type" size="sm" :items="typeItems" />
                <UInput v-model="s.value" size="sm" :placeholder="s.type === 'event' ? 'signup' : $t('goals.pathPlaceholder')" class="font-mono-tight" />
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-x"
                  :disabled="steps.length <= 2"
                  :aria-label="$t('goals.remove')"
                  @click="removeStep(i)"
                />
              </div>
              <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-plus" :disabled="steps.length >= 8" @click="addStep">
                {{ $t('funnels.addStep') }}
              </UButton>
            </div>
          </UFormField>
          <UFormField :label="$t('funnels.window')">
            <USelect v-model="windowMinutes" :items="windowItems" class="w-48" />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="open = false">
            {{ $t('dashboard.cancel') }}
          </UButton>
          <UButton color="primary" :disabled="!valid" @click="submit">
            {{ $t('goals.save') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>
