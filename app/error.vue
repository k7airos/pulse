<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const { t, locale } = useI18n()
const notFound = computed(() => props.error.statusCode === 404)

useHead(() => ({ htmlAttrs: { lang: locale.value === 'en' ? 'en' : 'zh-CN' } }))
useSeoMeta({ title: () => t(notFound.value ? 'errors.notFoundTitle' : 'errors.errorTitle') })
</script>

<template>
  <UApp>
    <AppHeader minimal />
    <main class="mx-auto flex w-full max-w-sm flex-col items-center px-4 pt-[16vh] text-center">
      <div class="num text-4xl font-semibold text-[var(--brand)]">
        {{ error.statusCode }}
      </div>
      <h1 class="mt-2 text-base font-semibold text-highlighted">
        {{ notFound ? $t('errors.notFoundTitle') : $t('errors.errorTitle') }}
      </h1>
      <p class="mt-1 text-xs text-muted">
        {{ notFound ? $t('errors.notFoundDesc') : $t('errors.errorDesc') }}
      </p>
      <UButton class="mt-4" color="primary" @click="clearError({ redirect: '/' })">
        {{ $t('errors.backHome') }}
      </UButton>
    </main>
  </UApp>
</template>
