<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()

const items = computed(() =>
  (locales.value as Array<{ code: string, name: string }>).map(l => ({
    label: l.name,
    type: 'checkbox' as const,
    checked: l.code === locale.value,
    onSelect: () => {
      void setLocale(l.code as 'zh-CN' | 'en')
    },
  })),
)

const currentLabel = computed(() => {
  const list = locales.value as Array<{ code: string, name: string }>
  return list.find(l => l.code === locale.value)?.name || locale.value
})
</script>

<template>
  <UDropdownMenu :items="items">
    <UButton
      variant="ghost"
      color="neutral"
      icon="i-lucide-languages"
      :aria-label="$t('nav.language')"
    >
      <span class="hidden md:inline">{{ currentLabel }}</span>
    </UButton>
  </UDropdownMenu>
</template>
