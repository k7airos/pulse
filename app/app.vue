<script setup lang="ts">
import { en, zh_cn } from '@nuxt/ui/locale'

// Nuxt UI's own strings (modal close, "no results", date pickers…) follow the app language
const { locale } = useI18n()
const uiLocale = computed(() => (locale.value === 'en' ? en : zh_cn))

useHead(() => ({ htmlAttrs: { lang: locale.value === 'en' ? 'en' : 'zh-CN' } }))
</script>

<template>
  <UApp :locale="uiLocale" :toaster="{ position: 'top-center', duration: 2800 }">
    <NuxtPage />
  </UApp>
</template>
