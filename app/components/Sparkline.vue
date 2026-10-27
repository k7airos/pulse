<script setup lang="ts">
const props = withDefaults(defineProps<{
  values: number[]
  width?: number
  height?: number
  label?: string
  /** Stretch to the container width (cards) instead of a fixed pixel width. */
  fluid?: boolean
}>(), { width: 96, height: 24, label: '', fluid: false })

const geometry = computed(() => {
  const v = props.values
  if (!v.length)
    return { line: '', area: '', flat: true }
  const max = Math.max(...v, 1)
  const stepX = v.length > 1 ? props.width / (v.length - 1) : 0
  const pad = 2
  const y = (n: number) => props.height - pad - (n / max) * (props.height - pad * 2)
  const pts = v.map((n, i) => `${(i * stepX).toFixed(1)},${y(n).toFixed(1)}`)
  const line = pts.join(' ')
  const area = `0,${props.height} ${line} ${props.width},${props.height}`
  return { line, area, flat: v.every(n => n === 0) }
})
</script>

<template>
  <svg
    :width="fluid ? '100%' : width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    role="img"
    :aria-label="label"
    :preserveAspectRatio="fluid ? 'none' : undefined"
    class="block overflow-visible"
  >
    <template v-if="!geometry.flat">
      <polygon :points="geometry.area" fill="var(--brand)" opacity="0.14" />
      <polyline
        :points="geometry.line"
        fill="none"
        stroke="var(--brand)"
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
    </template>
    <line
      v-else
      x1="0"
      :x2="width"
      :y1="height - 2"
      :y2="height - 2"
      stroke="var(--family-border)"
      stroke-width="1.5"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>
