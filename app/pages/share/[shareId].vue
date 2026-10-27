<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const shareId = computed(() => String(route.params.shareId))

const name = ref('')
const domain = ref<string | null>(null)
const tz = ref('')

useSeoMeta({
  title: () => name.value ? t('site.seoTitleNamed', { name: name.value }) : t('site.seoTitle'),
  robots: 'noindex, nofollow',
})

function onLoaded(r: { website: { name: string, domain: string | null }, range: { tz: string } }) {
  name.value = r.website.name
  domain.value = r.website.domain
  tz.value = r.range.tz
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader minimal>
      <template #crumb>
        <span class="truncate font-medium text-highlighted">{{ name || '…' }}</span>
        <UBadge size="sm" variant="subtle" color="neutral">
          {{ $t('settings.readonly') }}
        </UBadge>
      </template>
    </AppHeader>
    <main class="mx-auto w-full max-w-[1180px] space-y-3 px-3 py-3 sm:px-4">
      <p v-if="domain" class="font-mono-tight text-[11px] text-muted">
        {{ domain }}<template v-if="tz"> · {{ tz }}</template>
      </p>
      <SiteReport mode="share" :share-id="shareId" @loaded="onLoaded" />
    </main>
  </div>
</template>
