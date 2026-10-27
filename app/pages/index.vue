<script setup lang="ts">
import type { WindowKey, WindowOverview } from '~/types/overview'

interface SiteRow {
  id: string
  name: string
  domain: string | null
  publicId: string
  createdAt: number
  windows: WindowOverview[]
  sparkline: number[]
  active: number
}

type SortKey = 'name' | 'active' | 'pageviews' | 'visitors' | 'events'

const { t } = useI18n()
useSeoMeta({
  title: () => t('app.adminTitle'),
  description: () => t('app.metaDescription'),
})

const toast = useToast()
const { formatNum } = useFormat()
const { apiKey, error, ready, loggingIn, isLoggedIn, login, logout, api } = usePulseAdmin()

const keyInput = ref('')
const sites = ref<SiteRow[]>([])
const loading = ref(false)
const loaded = ref(false)
const period = ref<WindowKey>('d7')
const query = ref('')
const sortKey = ref<SortKey>('pageviews')
const sortDir = ref<'asc' | 'desc'>('desc')

const createOpen = ref(false)
const creating = ref(false)
const newName = ref('')
const newDomain = ref('')
const createdFlash = ref('')

const periodItems = computed(() => [
  { label: t('period.short_d1'), value: 'd1' as const },
  { label: t('period.short_d7'), value: 'd7' as const },
  { label: t('period.short_d30'), value: 'd30' as const },
])

function win(s: SiteRow) {
  return s.windows.find(w => w.key === period.value)
}

async function load(silent = false) {
  if (!apiKey.value)
    return
  if (!silent)
    loading.value = true
  try {
    const res = await api<{ sites: SiteRow[] }>('/v1/overview')
    sites.value = res.sites || []
    loaded.value = true
  }
  catch { /* error ref already set by api() */ }
  finally {
    loading.value = false
  }
}

/** No activity in either period → no delta to show (renders as a muted dash). */
function chg(s: SiteRow, k: 'pageviews' | 'visitors' | 'events') {
  const w = win(s)
  if (!w || (w.current[k] === 0 && w.previous[k] === 0))
    return null
  return w.change[k]
}

function metricOf(s: SiteRow, k: Exclude<SortKey, 'name' | 'active'>) {
  return win(s)?.current[k] ?? 0
}

// 流量最大的前 3 个站点做成重点卡片；搜索时不分层，直接在列表里找
const searching = computed(() => !!query.value.trim())

const topSites = computed(() => {
  if (searching.value)
    return []
  return [...sites.value]
    .filter(s => metricOf(s, 'pageviews') > 0)
    .sort((a, b) => metricOf(b, 'pageviews') - metricOf(a, 'pageviews'))
    .slice(0, 3)
})

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  const topIds = new Set(topSites.value.map(s => s.id))
  const list = sites.value.filter(s =>
    !topIds.has(s.id) && (!q || s.name.toLowerCase().includes(q) || (s.domain || '').toLowerCase().includes(q) || s.publicId.toLowerCase().includes(q)),
  )
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    if (sortKey.value === 'name')
      return a.name.localeCompare(b.name) * dir
    if (sortKey.value === 'active')
      return (a.active - b.active) * dir
    return (metricOf(a, sortKey.value) - metricOf(b, sortKey.value)) * dir
  })
})

// 汇总条：所选时间窗内全部站点合计
const totals = computed(() => {
  let pageviews = 0
  let prevPv = 0
  let visitors = 0
  let events = 0
  let active = 0
  for (const s of sites.value) {
    const w = win(s)
    if (!w)
      continue
    pageviews += w.current.pageviews
    prevPv += w.previous.pageviews
    visitors += w.current.visitors
    events += w.current.events
    active += s.active
  }
  const change = prevPv === 0 ? (pageviews > 0 ? null : 0) : (pageviews - prevPv) / prevPv
  return { pageviews, visitors, events, active, change }
})

function setSort(k: SortKey) {
  if (sortKey.value === k) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
    return
  }
  sortKey.value = k
  sortDir.value = k === 'name' ? 'asc' : 'desc'
}

function ariaSort(k: SortKey) {
  if (sortKey.value !== k)
    return 'none'
  return sortDir.value === 'asc' ? 'ascending' : 'descending'
}

async function onLogin() {
  const ok = await login(keyInput.value)
  if (ok) {
    keyInput.value = ''
    toast.add({ title: t('login.success'), color: 'success' })
    await load()
  }
}

function onLogout() {
  logout()
  sites.value = []
  loaded.value = false
  createdFlash.value = ''
  createOpen.value = false
  toast.add({ title: t('login.loggedOut'), color: 'neutral' })
}

function openCreate() {
  newName.value = ''
  newDomain.value = ''
  createdFlash.value = ''
  createOpen.value = true
}

async function createWebsite() {
  if (!newName.value.trim())
    return
  creating.value = true
  try {
    const res = await api<{
      website: { id: string, publicId: string, name: string }
      keys: Array<{ name: string, key: string, scopes: string[] }>
    }>('/v1/websites', {
      method: 'POST',
      body: {
        name: newName.value.trim(),
        domain: newDomain.value.trim() || null,
        withKeys: true,
      },
    })
    createdFlash.value = [
      `publicId: ${res.website.publicId}`,
      ...res.keys.map(k => `${k.name} [${k.scopes.join(',')}]: ${k.key}`),
    ].join('\n')
    toast.add({ title: t('dashboard.createOk'), description: t('dashboard.createOkDesc'), color: 'success' })
    newName.value = ''
    newDomain.value = ''
    await load(true)
  }
  catch {
    toast.add({ title: t('dashboard.createFail'), description: error.value || t('dashboard.retry'), color: 'error' })
  }
  finally {
    creating.value = false
  }
}

async function copyFlash() {
  try {
    await navigator.clipboard.writeText(createdFlash.value)
    toast.add({ title: t('docs.copied'), color: 'success' })
  }
  catch {
    toast.add({ title: t('docs.copyFail'), color: 'error' })
  }
}

function closeCreate() {
  createOpen.value = false
  createdFlash.value = ''
}

// 约每分钟静默刷新一次，页面不可见时暂停
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  if (apiKey.value)
    void load()
  timer = setInterval(() => {
    if (document.visibilityState === 'visible' && apiKey.value && !createOpen.value)
      void load(true)
  }, 60_000)
})
onBeforeUnmount(() => clearInterval(timer))

watch(ready, (v) => {
  if (v && apiKey.value && !loaded.value)
    void load()
})
</script>

<template>
  <div class="min-h-screen">
    <AppHeader :show-logout="isLoggedIn" @logout="onLogout" />

    <!-- 登录 -->
    <main
      v-if="ready && !isLoggedIn"
      class="mx-auto flex w-full max-w-sm flex-col px-4 pt-[14vh]"
    >
      <div class="rounded-lg border border-default bg-default p-5">
        <h1 class="text-base font-semibold text-highlighted">
          {{ $t('login.title') }}
        </h1>
        <p class="mt-1 text-xs text-muted">
          {{ $t('login.hint') }}
        </p>
        <form class="mt-4 space-y-3" @submit.prevent="onLogin">
          <UFormField :label="$t('login.keyLabel')">
            <UInput
              v-model="keyInput"
              type="password"
              :placeholder="$t('login.keyPlaceholder')"
              autocomplete="off"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UAlert v-if="error" color="error" variant="subtle" :title="error" />
          <UButton block type="submit" color="primary" :loading="loggingIn">
            {{ $t('login.submit') }}
          </UButton>
        </form>
        <p class="mt-3 text-[11px] text-muted">
          {{ $t('login.prodHint') }}
          <code class="font-mono-tight">PULSE_DATA_DIR/BOOTSTRAP_ADMIN_KEY.txt</code>
        </p>
      </div>
    </main>

    <!-- 仪表盘 -->
    <main v-else-if="isLoggedIn" class="mx-auto w-full max-w-[1180px] px-3 py-3 sm:px-4">
      <!-- 工具栏 -->
      <div class="flex flex-wrap items-center gap-2">
        <UTabs
          v-model="period"
          :items="periodItems"
          :content="false"
          size="xs"
          variant="pill"
          class="w-auto"
        />
        <UInput
          v-model="query"
          icon="i-lucide-search"
          size="sm"
          :placeholder="$t('dashboard.search')"
          class="w-full min-w-0 sm:w-64"
          :aria-label="$t('dashboard.search')"
        />
        <div class="ml-auto flex items-center gap-1.5">
          <UButton
            variant="outline"
            color="neutral"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            :aria-label="$t('nav.refresh')"
            @click="load()"
          >
            <span class="hidden sm:inline">{{ $t('nav.refresh') }}</span>
          </UButton>
          <UButton color="primary" icon="i-lucide-plus" @click="openCreate">
            {{ $t('nav.createSite') }}
          </UButton>
        </div>
      </div>

      <!-- 汇总：一行小字，不抢重点 -->
      <p class="num mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
        <span>{{ $t('dashboard.sites') }} <b class="font-semibold text-highlighted">{{ sites.length }}</b></span>
        <span>{{ $t('metric.pageviews') }} <b class="font-semibold text-highlighted">{{ formatNum(totals.pageviews) }}</b> <DeltaChip :change="totals.change" /></span>
        <span>{{ $t('metric.visitors') }} <b class="font-semibold text-highlighted">{{ formatNum(totals.visitors) }}</b></span>
        <span>{{ $t('metric.events') }} <b class="font-semibold text-highlighted">{{ formatNum(totals.events) }}</b></span>
        <span class="inline-flex items-center gap-1">
          <span class="size-1.5 rounded-full" :class="totals.active ? 'bg-[var(--pulse-up)]' : 'bg-[var(--family-border)]'" aria-hidden="true" />
          {{ $t('dashboard.online') }} <b class="font-semibold text-highlighted">{{ totals.active }}</b>
        </span>
      </p>

      <UAlert v-if="error" class="mt-3" color="error" variant="subtle" :title="error" />

      <!-- 重点：流量前 3 的站点 -->
      <section
        v-if="topSites.length"
        class="mt-3 grid gap-3 sm:grid-cols-3"
        :aria-label="$t('dashboard.top')"
      >
        <NuxtLink
          v-for="(s, i) in topSites"
          :key="s.id"
          :to="`/websites/${s.id}`"
          class="family-action group flex flex-col gap-3 rounded-xl border border-default bg-default p-4 transition-colors hover:border-[var(--brand)]"
          :class="i === 0 ? 'ring-1 ring-[var(--brand)]/30' : ''"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="num grid size-5 shrink-0 place-items-center rounded bg-[var(--brand-wash)] text-[11px] font-bold text-[var(--brand)]">{{ i + 1 }}</span>
                <h2 class="truncate text-[15px] font-semibold text-highlighted group-hover:text-primary">
                  {{ s.name }}
                </h2>
              </div>
              <div class="font-mono-tight mt-0.5 truncate text-[11px] text-muted">
                {{ s.domain || s.publicId }}
              </div>
            </div>
            <span
              class="num inline-flex shrink-0 items-center gap-1.5 text-xs"
              :class="s.active ? 'text-highlighted' : 'text-muted'"
              :title="$t('dashboard.online')"
            >
              <span class="size-1.5 rounded-full" :class="s.active ? 'bg-[var(--pulse-up)]' : 'bg-[var(--family-border)]'" aria-hidden="true" />
              {{ s.active }}
            </span>
          </div>

          <div>
            <div class="text-[11px] font-medium text-muted">
              {{ $t('metric.pageviews') }}
            </div>
            <div class="flex items-baseline gap-2">
              <span class="num text-3xl font-semibold leading-9 tracking-tight text-highlighted">{{ formatNum(win(s)?.current.pageviews) }}</span>
              <DeltaChip :change="chg(s, 'pageviews')" />
            </div>
          </div>

          <Sparkline :values="s.sparkline" fluid :height="44" :label="$t('dashboard.trend14')" />

          <div class="grid grid-cols-2 gap-3 border-t border-default pt-2.5">
            <div>
              <div class="text-[11px] text-muted">
                {{ $t('metric.visitors') }}
              </div>
              <div class="flex items-baseline gap-1.5">
                <span class="num text-sm font-semibold text-highlighted">{{ formatNum(win(s)?.current.visitors) }}</span>
                <DeltaChip :change="chg(s, 'visitors')" />
              </div>
            </div>
            <div>
              <div class="text-[11px] text-muted">
                {{ $t('metric.events') }}
              </div>
              <div class="flex items-baseline gap-1.5">
                <span class="num text-sm font-semibold text-highlighted">{{ formatNum(win(s)?.current.events) }}</span>
                <DeltaChip :change="chg(s, 'events')" />
              </div>
            </div>
          </div>
        </NuxtLink>
      </section>

      <!-- 其他站点 -->
      <h2 v-if="topSites.length && rows.length" class="mt-4 text-xs font-semibold text-muted">
        {{ $t('dashboard.others') }} · <span class="num">{{ rows.length }}</span>
      </h2>

      <!-- 站点表 -->
      <section v-if="rows.length || !topSites.length" class="mt-2 overflow-x-auto rounded-lg border border-default bg-default">
        <table v-if="rows.length" class="dt">
          <thead>
            <tr>
              <th :aria-sort="ariaSort('name')">
                <button type="button" class="th-sort" @click="setSort('name')">
                  {{ $t('dashboard.site') }}
                  <UIcon v-if="sortKey === 'name'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
                </button>
              </th>
              <th :aria-sort="ariaSort('active')" class="w-20">
                <button type="button" class="th-sort" @click="setSort('active')">
                  {{ $t('dashboard.online') }}
                  <UIcon v-if="sortKey === 'active'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
                </button>
              </th>
              <th class="hidden w-32 md:table-cell">
                {{ $t('dashboard.trend') }}
              </th>
              <th :aria-sort="ariaSort('pageviews')" class="w-28">
                <button type="button" class="th-sort" @click="setSort('pageviews')">
                  {{ $t('metric.pageviews') }}
                  <UIcon v-if="sortKey === 'pageviews'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
                </button>
              </th>
              <th :aria-sort="ariaSort('visitors')" class="w-28">
                <button type="button" class="th-sort" @click="setSort('visitors')">
                  {{ $t('metric.visitors') }}
                  <UIcon v-if="sortKey === 'visitors'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
                </button>
              </th>
              <th :aria-sort="ariaSort('events')" class="hidden w-28 sm:table-cell">
                <button type="button" class="th-sort" @click="setSort('events')">
                  {{ $t('metric.events') }}
                  <UIcon v-if="sortKey === 'events'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="s in rows"
              :key="s.id"
              class="row-link"
              @click="navigateTo(`/websites/${s.id}`)"
            >
              <td class="max-w-0 min-w-48 sm:w-[300px]">
                <NuxtLink
                  :to="`/websites/${s.id}`"
                  class="block truncate text-[13px] font-semibold text-highlighted hover:text-primary"
                  @click.stop
                >
                  {{ s.name }}
                </NuxtLink>
                <div class="font-mono-tight truncate text-[11px] leading-4 text-muted">
                  {{ s.domain || s.publicId }}
                </div>
              </td>
              <td>
                <span
                  class="num inline-flex items-center justify-end gap-1.5"
                  :class="s.active ? 'text-highlighted' : 'text-muted'"
                >
                  <span
                    class="size-1.5 rounded-full"
                    :class="s.active ? 'bg-[var(--pulse-up)]' : 'bg-[var(--family-border)]'"
                    aria-hidden="true"
                  />
                  {{ s.active }}
                </span>
              </td>
              <td class="hidden md:table-cell">
                <div class="flex justify-end">
                  <Sparkline :values="s.sparkline" :label="$t('dashboard.trend14')" />
                </div>
              </td>
              <td>
                <div class="num text-[13px] font-semibold leading-4 text-highlighted">
                  {{ formatNum(win(s)?.current.pageviews) }}
                </div>
                <DeltaChip :change="chg(s, 'pageviews')" />
              </td>
              <td>
                <div class="num text-[13px] font-semibold leading-4 text-highlighted">
                  {{ formatNum(win(s)?.current.visitors) }}
                </div>
                <DeltaChip :change="chg(s, 'visitors')" />
              </td>
              <td class="hidden sm:table-cell">
                <div class="num text-[13px] font-semibold leading-4 text-highlighted">
                  {{ formatNum(win(s)?.current.events) }}
                </div>
                <DeltaChip :change="chg(s, 'events')" />
              </td>
            </tr>
          </tbody>
        </table>

        <div v-else-if="!loaded" class="py-16 text-center text-xs text-muted">
          {{ $t('app.loadingData') }}
        </div>
        <div v-else-if="sites.length" class="py-12 text-center text-xs text-muted">
          {{ $t('dashboard.noMatch') }}
        </div>
        <div v-else class="py-14 text-center">
          <p class="text-xs text-muted">
            {{ $t('dashboard.empty') }}
          </p>
          <UButton class="mt-3" color="primary" icon="i-lucide-plus" @click="openCreate">
            {{ $t('nav.createSite') }}
          </UButton>
        </div>
      </section>
    </main>

    <div v-else class="flex min-h-[50vh] items-center justify-center text-xs text-muted">
      {{ $t('app.loading') }}
    </div>

    <UModal
      v-model:open="createOpen"
      :title="$t('dashboard.createModalTitle')"
      :description="$t('dashboard.createModalDesc')"
    >
      <template #body>
        <div class="space-y-3">
          <UFormField :label="$t('dashboard.name')" required>
            <UInput
              v-model="newName"
              :placeholder="$t('dashboard.namePlaceholder')"
              class="w-full"
              autofocus
              @keyup.enter="createWebsite"
            />
          </UFormField>
          <UFormField :label="$t('dashboard.domainOptional')" :hint="$t('dashboard.domainHint')">
            <UInput
              v-model="newDomain"
              :placeholder="$t('dashboard.domainPlaceholder')"
              class="w-full"
              @keyup.enter="createWebsite"
            />
          </UFormField>

          <UAlert
            v-if="createdFlash"
            color="success"
            variant="subtle"
            :title="$t('dashboard.createSuccessTitle')"
            :description="createdFlash"
            class="whitespace-pre-wrap break-all"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            v-if="createdFlash"
            variant="outline"
            color="neutral"
            icon="i-lucide-copy"
            @click="copyFlash"
          >
            {{ $t('docs.copy') }}
          </UButton>
          <UButton variant="ghost" color="neutral" @click="closeCreate">
            {{ createdFlash ? $t('dashboard.close') : $t('dashboard.cancel') }}
          </UButton>
          <UButton
            v-if="!createdFlash"
            color="primary"
            :loading="creating"
            :disabled="!newName.trim()"
            @click="createWebsite"
          >
            {{ $t('dashboard.createAndKeys') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
