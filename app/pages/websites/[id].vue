<script setup lang="ts">
import type { SiteSettings } from '~/components/SiteSettingsModal.vue'

const { t, locale } = useI18n()
const route = useRoute()
const id = computed(() => String(route.params.id))
const toast = useToast()
const origin = useRequestURL().origin
const { api, error, isLoggedIn, logout, ready, apiKey } = usePulseAdmin()

const website = ref<(SiteSettings & { publicId: string }) | null>(null)
const active = ref(0)
const serverTz = ref('UTC')
const settingsOpen = ref(false)
const reportRef = ref<{ reload: () => Promise<void> } | null>(null)

const keys = ref<Array<{
  id: string
  name: string
  keyPrefix: string
  scopes: string
  revokedAt: number | null
  lastUsedAt: number | null
}>>([])
const keysDenied = ref(false)
const newKeyFlash = ref('')

const embed = computed(() => `<script defer src="${origin}/script.js"
  data-website-id="${website.value?.publicId ?? ''}"
  data-auto-track="true"><\/script>`)

async function loadSite() {
  if (!apiKey.value)
    return
  try {
    const [w, o] = await Promise.all([
      api<{ website: NonNullable<typeof website.value> }>(`/v1/websites/${id.value}`),
      api<{ sites: Array<{ active: number }> }>(`/v1/overview?websiteId=${encodeURIComponent(id.value)}`),
    ])
    website.value = w.website
    active.value = o.sites[0]?.active || 0
    void loadKeys()
  }
  catch { /* error ref set by api() */ }
}

async function loadKeys() {
  try {
    keys.value = (await api<{ keys: typeof keys.value }>(`/v1/websites/${id.value}/keys`)).keys
    keysDenied.value = false
  }
  catch {
    // read-only keys cannot list keys; just hide the panel
    keysDenied.value = true
    error.value = ''
  }
}

async function createKey(scopes: string[]) {
  try {
    const res = await api<{ key: { name: string, key: string, scopes: string[] } }>(
      `/v1/websites/${id.value}/keys`,
      { method: 'POST', body: { name: `key-${scopes.join('-')}-${Date.now()}`, scopes } },
    )
    newKeyFlash.value = `${res.key.scopes.join(',')}: ${res.key.key}`
    toast.add({ title: t('site.keyCreated'), description: t('site.keyCreatedDesc'), color: 'success' })
    await loadKeys()
  }
  catch {
    toast.add({ title: t('dashboard.createFail'), description: error.value || t('dashboard.retry'), color: 'error' })
  }
}

// 吊销要二次确认：第一次点击进入“确认”状态，3 秒内再点才执行
const armed = ref('')
let armTimer: ReturnType<typeof setTimeout> | undefined
async function revoke(keyId: string) {
  if (armed.value !== keyId) {
    armed.value = keyId
    clearTimeout(armTimer)
    armTimer = setTimeout(() => (armed.value = ''), 3000)
    return
  }
  armed.value = ''
  try {
    await api(`/v1/keys/${keyId}`, { method: 'DELETE' })
    toast.add({ title: t('site.revoked'), color: 'neutral' })
    await loadKeys()
  }
  catch {
    toast.add({ title: t('dashboard.createFail'), description: error.value || t('dashboard.retry'), color: 'error' })
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: t('docs.copied'), color: 'success' })
  }
  catch {
    toast.add({ title: t('docs.copyFail'), color: 'error' })
  }
}

function fmtTime(ts: number | null) {
  if (!ts)
    return '—'
  return new Date(ts).toLocaleString(locale.value, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function onLogout() {
  logout()
  void navigateTo('/')
}

async function onSettingsSaved() {
  await loadSite()
  await reportRef.value?.reload()
}

onMounted(async () => {
  try {
    serverTz.value = (await $fetch<{ timezone: string }>('/v1/health')).timezone || 'UTC'
  }
  catch { /* keep default */ }
  if (apiKey.value)
    void loadSite()
})
watch(ready, (v) => {
  if (v && apiKey.value && !website.value)
    void loadSite()
})

useSeoMeta({
  title: () => website.value ? t('site.seoTitleNamed', { name: website.value.name }) : t('site.seoTitle'),
})
</script>

<template>
  <div class="min-h-screen">
    <AppHeader :show-logout="isLoggedIn" @logout="onLogout">
      <template #crumb>
        <NuxtLink to="/" class="shrink-0 hover:text-highlighted">
          {{ $t('nav.allSites') }}
        </NuxtLink>
        <UIcon name="i-lucide-chevron-right" class="size-3.5 shrink-0" />
        <span class="truncate font-medium text-highlighted">{{ website?.name || '…' }}</span>
      </template>
    </AppHeader>

    <main
      v-if="ready && !isLoggedIn"
      class="mx-auto mt-[14vh] w-full max-w-sm px-4 text-center"
    >
      <p class="mb-3 text-sm text-muted">
        {{ $t('site.loginRequired') }}
      </p>
      <UButton to="/" color="primary">
        {{ $t('site.goLogin') }}
      </UButton>
    </main>

    <main v-else class="mx-auto w-full max-w-[1180px] space-y-3 px-3 py-3 sm:px-4">
      <UAlert v-if="error && !website" color="error" variant="subtle" :title="error" />

      <template v-if="website">
        <!-- 标题行 -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div class="min-w-0">
            <h1 class="flex items-center gap-2 truncate text-base font-semibold leading-5 text-highlighted">
              {{ website.name }}
              <span class="num inline-flex items-center gap-1 text-xs font-normal text-muted" :title="$t('dashboard.online')">
                <span class="size-1.5 rounded-full" :class="active ? 'bg-[var(--pulse-up)]' : 'bg-[var(--family-border)]'" aria-hidden="true" />
                {{ active }}
              </span>
            </h1>
            <button
              type="button"
              class="font-mono-tight flex max-w-full items-center gap-1 truncate text-[11px] text-muted hover:text-highlighted"
              :title="$t('docs.copy')"
              @click="copy(website.publicId)"
            >
              <span class="truncate">{{ website.publicId }}<template v-if="website.domain"> · {{ website.domain }}</template></span>
              <UIcon name="i-lucide-copy" class="size-3 shrink-0" />
            </button>
          </div>
          <div class="ml-auto flex items-center gap-1.5">
            <UButton v-if="website.shareId" variant="ghost" color="neutral" icon="i-lucide-link" :to="`/share/${website.shareId}`" target="_blank">
              <span class="hidden sm:inline">{{ $t('settings.shared') }}</span>
            </UButton>
            <UButton variant="outline" color="neutral" icon="i-lucide-settings" @click="settingsOpen = true">
              {{ $t('settings.open') }}
            </UButton>
          </div>
        </div>

        <SiteReport ref="reportRef" mode="admin" :site-id="id" />

        <!-- 接入与密钥 -->
        <div class="grid items-start gap-3 lg:grid-cols-5">
          <section class="rounded-lg border border-default bg-default lg:col-span-2">
            <header class="flex items-center justify-between border-b border-default px-3 py-1.5">
              <h2 class="text-xs font-semibold text-highlighted">
                {{ $t('site.embed') }}
              </h2>
              <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-copy" @click="copy(embed)">
                {{ $t('docs.copy') }}
              </UButton>
            </header>
            <pre class="font-mono-tight overflow-x-auto p-3 text-[11px] leading-relaxed text-muted">{{ embed }}</pre>
          </section>

          <section v-if="!keysDenied" class="rounded-lg border border-default bg-default lg:col-span-3">
            <header class="flex flex-wrap items-center justify-between gap-2 border-b border-default px-3 py-1.5">
              <h2 class="text-xs font-semibold text-highlighted">
                {{ $t('site.apiKeys') }}
              </h2>
              <div class="flex gap-1">
                <UButton size="xs" variant="soft" color="neutral" @click="createKey(['collect'])">
                  {{ $t('site.addCollect') }}
                </UButton>
                <UButton size="xs" variant="soft" color="neutral" @click="createKey(['read'])">
                  {{ $t('site.addRead') }}
                </UButton>
                <UButton size="xs" variant="soft" color="neutral" @click="createKey(['collect', 'read'])">
                  {{ $t('site.addBoth') }}
                </UButton>
              </div>
            </header>

            <div v-if="newKeyFlash" class="flex items-start gap-2 border-b border-default bg-[var(--brand-wash)] px-3 py-2">
              <div class="min-w-0 flex-1">
                <div class="text-[11px] font-semibold text-highlighted">
                  {{ $t('site.keyOnceTitle') }}
                </div>
                <code class="font-mono-tight block break-all text-[11px]">{{ newKeyFlash }}</code>
              </div>
              <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-copy" @click="copy(newKeyFlash)" />
            </div>

            <div class="overflow-x-auto">
              <table v-if="keys.length" class="dt">
                <thead>
                  <tr>
                    <th>{{ $t('site.name') }}</th>
                    <th>{{ $t('site.scopes') }}</th>
                    <th class="hidden sm:table-cell">
                      {{ $t('site.lastUsed') }}
                    </th>
                    <th>{{ $t('site.status') }}</th>
                    <th class="w-20" />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="k in keys" :key="k.id" :class="k.revokedAt ? 'opacity-55' : ''">
                    <td class="max-w-0 min-w-32">
                      <div class="truncate text-[13px] font-medium text-highlighted">
                        {{ k.name }}
                      </div>
                      <div class="font-mono-tight text-[11px] leading-4 text-muted">
                        {{ k.keyPrefix }}…
                      </div>
                    </td>
                    <td class="font-mono-tight text-[11px]">
                      {{ k.scopes }}
                    </td>
                    <td class="num hidden text-[11px] text-muted sm:table-cell">
                      {{ fmtTime(k.lastUsedAt) }}
                    </td>
                    <td>
                      <UBadge size="sm" variant="subtle" :color="k.revokedAt ? 'neutral' : 'success'">
                        {{ k.revokedAt ? $t('site.statusRevoked') : $t('site.active') }}
                      </UBadge>
                    </td>
                    <td>
                      <UButton
                        v-if="!k.revokedAt"
                        size="xs"
                        :color="armed === k.id ? 'error' : 'neutral'"
                        :variant="armed === k.id ? 'solid' : 'ghost'"
                        @click="revoke(k.id)"
                      >
                        {{ armed === k.id ? $t('site.revokeConfirm') : $t('site.revoke') }}
                      </UButton>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="px-3 py-6 text-center text-xs text-muted">
                {{ $t('site.noKeys') }}
              </p>
            </div>
          </section>
        </div>

        <SiteSettingsModal
          v-model:open="settingsOpen"
          :site="website"
          :server-tz="serverTz"
          @saved="onSettingsSaved"
          @deleted="navigateTo('/')"
        />
      </template>

      <div v-else class="py-20 text-center text-xs text-muted">
        {{ $t('app.loading') }}
      </div>
    </main>
  </div>
</template>
