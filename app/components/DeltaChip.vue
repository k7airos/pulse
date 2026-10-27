<script setup lang="ts">
const props = defineProps<{ change: number | null | undefined }>()
const { formatDelta, deltaTone } = useFormat()
const tone = computed(() => deltaTone(props.change))
// 颜色之外再用箭头表达方向，避免只靠颜色传达状态
const icon = computed(() => tone.value === 'up' ? 'i-lucide-arrow-up' : tone.value === 'down' ? 'i-lucide-arrow-down' : '')
</script>

<template>
  <span
    class="num inline-flex items-center gap-0.5 text-[11px] font-medium leading-none"
    :class="{
      'text-[var(--pulse-up)]': tone === 'up',
      'text-[var(--pulse-down)]': tone === 'down',
      'text-muted': tone === 'flat' || tone === 'empty',
    }"
  >
    <UIcon v-if="icon" :name="icon" class="size-3" />
    {{ formatDelta(change) }}
  </span>
</template>
