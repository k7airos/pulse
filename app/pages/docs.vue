<script setup lang="ts">
const { t, locale } = useI18n()
useSeoMeta({
  title: () => t('app.docsTitle'),
  description: () => t('app.docsDesc') || t('app.metaDescription'),
})

const toast = useToast()

// The spec text comes from the server; ask for the UI language (refetches when it changes)
const lang = computed(() => locale.value === 'en' ? 'en' : 'zh')
const { data: doc, pending, error } = await useFetch<Record<string, any>>('/v1/openapi.json', {
  key: 'pulse-openapi',
  query: { lang },
  watch: [lang],
})

type Op = {
  method: string
  path: string
  summary: string
  description?: string
  tag: string
  auth: boolean
  params: Array<{ name: string, in: string, required?: boolean, schema?: { type?: string, enum?: string[] } }>
  bodyExample?: unknown
  responseExample?: unknown
  curl: string
}

function methodColor(m: string) {
  const u = m.toUpperCase()
  if (u === 'GET')
    return 'success' as const
  if (u === 'POST')
    return 'primary' as const
  if (u === 'DELETE')
    return 'error' as const
  if (u === 'PATCH' || u === 'PUT')
    return 'warning' as const
  return 'neutral' as const
}

function buildOps(document: Record<string, any> | null): Op[] {
  if (!document?.paths)
    return []
  const ops: Op[] = []
  const paths = document.paths as Record<string, Record<string, any>>
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, def] of Object.entries(methods || {})) {
      if (!def || typeof def !== 'object')
        continue
      const d = def as any
      const auth = !(Array.isArray(d.security) && d.security.length === 0)
      const params = (d.parameters || []) as Op['params']
      const bodyExample
        = d.requestBody?.content?.['application/json']?.example
        || d.requestBody?.content?.['text/plain']?.example
      const responseExample
        = d.responses?.['200']?.content?.['application/json']?.example
        || d.responses?.['202']?.content?.['application/json']?.example

      const m = method.toUpperCase()
      let curl = `curl -sS '${path}'`
      if (m !== 'GET')
        curl = `curl -sS -X ${m} '${path}'`
      if (auth)
        curl += ` \\\n  -H 'x-api-key: $PULSE_KEY'`
      if (bodyExample && typeof bodyExample === 'object') {
        curl += ` \\\n  -H 'content-type: application/json' \\\n  -d '${JSON.stringify(bodyExample)}'`
      }
      else if (typeof bodyExample === 'string') {
        curl += ` \\\n  -H 'content-type: text/plain' \\\n  -d '${bodyExample}'`
      }

      ops.push({
        method: m,
        path,
        summary: d.summary || path,
        description: d.description,
        tag: (d.tags && d.tags[0]) || t('docs.tagOther'),
        auth,
        params,
        bodyExample,
        responseExample,
        curl,
      })
    }
  }
  return ops
}

const operations = computed(() => buildOps(doc.value))

const tags = computed(() => {
  const order = ((doc.value?.tags || []) as Array<{ name: string }>).map(t => t.name)
  const set = new Set(operations.value.map(o => o.tag))
  const listed = order.filter(t => set.has(t))
  for (const t of set) {
    if (!listed.includes(t))
      listed.push(t)
  }
  return listed
})

const activeTag = ref('all')
const q = ref('')

const filtered = computed(() => {
  return operations.value.filter((o) => {
    if (activeTag.value !== 'all' && o.tag !== activeTag.value)
      return false
    if (!q.value.trim())
      return true
    const s = q.value.toLowerCase()
    return (
      o.path.toLowerCase().includes(s)
      || o.summary.toLowerCase().includes(s)
      || (o.description || '').toLowerCase().includes(s)
      || o.method.toLowerCase().includes(s)
    )
  })
})

const grouped = computed(() => {
  const map = new Map<string, Op[]>()
  for (const op of filtered.value) {
    if (!map.has(op.tag))
      map.set(op.tag, [])
    map.get(op.tag)!.push(op)
  }
  return [...map.entries()]
})

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: t('docs.copied'), color: 'success' })
  }
  catch {
    toast.add({ title: t('docs.copyFail'), color: 'error' })
  }
}

const hostHint = computed(() => {
  if (import.meta.client)
    return window.location.origin
  return useRequestURL().origin
})
</script>

<template>
  <div class="min-h-screen">
    <AppHeader>
      <template #crumb>
        <NuxtLink to="/" class="shrink-0 hover:text-highlighted">
          {{ $t('nav.admin') }}
        </NuxtLink>
        <UIcon name="i-lucide-chevron-right" class="size-3.5 shrink-0" />
        <span class="truncate font-medium text-highlighted">{{ $t('docs.badge') }}</span>
      </template>
      <template #actions>
        <UButton
          to="/v1/openapi.json"
          external
          target="_blank"
          variant="ghost"
          color="neutral"
          icon="i-lucide-braces"
        >
          <span class="hidden md:inline">{{ $t('nav.openapiJson') }}</span>
        </UButton>
      </template>
    </AppHeader>

    <main class="mx-auto w-full max-w-5xl px-3 py-4 sm:px-4">
    <div v-if="pending" class="py-20 text-center text-sm text-muted">
      {{ $t('docs.loading') }}
    </div>

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      :title="$t('docs.loadFail')"
      :description="$t('docs.loadFailDesc')"
    />

    <template v-else-if="doc">
      <header class="mb-5 space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge color="primary" variant="subtle">
            {{ $t('docs.badge') }}
          </UBadge>
          <UBadge color="neutral" variant="subtle">
            v{{ doc.info?.version }}
          </UBadge>
          <UBadge color="neutral" variant="outline">
            OpenAPI 3.0
          </UBadge>
        </div>
        <h1 class="text-xl font-semibold tracking-tight text-highlighted">
          {{ doc.info?.title || 'Pulse API' }}
        </h1>
        <p class="max-w-2xl text-sm leading-relaxed text-muted">
          {{ doc.info?.description }}
        </p>
      </header>

      <UCard class="mb-4" variant="subtle">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="space-y-2">
            <h2 class="text-sm font-semibold text-highlighted">
              {{ $t('docs.authTitle') }}
            </h2>
            <p class="text-sm text-muted">
              {{ $t('docs.authBody') }}
            </p>
            <code class="block rounded-lg bg-elevated px-3 py-2 font-mono-tight text-xs">
              x-api-key: pk_live_…
            </code>
            <p class="text-xs text-muted">
              {{ $t('docs.authOr') }} <code class="font-mono-tight">Authorization: Bearer pk_live_…</code>
              · {{ $t('docs.scopes') }}:
              <code class="font-mono-tight">collect</code> /
              <code class="font-mono-tight">read</code> /
              <code class="font-mono-tight">admin</code>
            </p>
          </div>
          <div class="shrink-0 space-y-1 text-left sm:text-right text-xs text-muted">
            <div>{{ $t('docs.baseUrl') }}</div>
            <code class="font-mono-tight text-highlighted">{{ hostHint }}</code>
          </div>
        </div>
      </UCard>

      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap gap-2">
          <UButton
            size="sm"
            :variant="activeTag === 'all' ? 'solid' : 'soft'"
            :color="activeTag === 'all' ? 'primary' : 'neutral'"
            @click="activeTag = 'all'"
          >
            {{ $t('docs.all') }}
          </UButton>
          <UButton
            v-for="t in tags"
            :key="t"
            size="sm"
            :variant="activeTag === t ? 'solid' : 'soft'"
            :color="activeTag === t ? 'primary' : 'neutral'"
            @click="activeTag = t"
          >
            {{ t }}
          </UButton>
        </div>
        <UInput
          v-model="q"
          icon="i-lucide-search"
          :placeholder="$t('docs.search')"
          class="w-full sm:w-64"
          size="sm"
        />
      </div>

      <div class="space-y-6">
        <section
          v-for="[tag, ops] in grouped"
          :key="tag"
        >
          <div class="mb-3 flex items-center gap-2">
            <h2 class="text-sm font-semibold text-highlighted">
              {{ tag }}
            </h2>
            <UBadge color="neutral" variant="subtle" size="sm">
              {{ ops.length }}
            </UBadge>
          </div>

          <div class="space-y-3">
            <UCard
              v-for="op in ops"
              :key="`${op.method}:${op.path}`"
              :ui="{ body: 'space-y-3 p-3 sm:p-4' }"
            >
              <div class="flex flex-wrap items-start gap-2 sm:gap-3">
                <UBadge
                  :color="methodColor(op.method)"
                  variant="subtle"
                  class="min-w-[4.2rem] justify-center font-mono text-[11px] font-bold tracking-wide"
                >
                  {{ op.method }}
                </UBadge>
                <div class="min-w-0 flex-1">
                  <code class="break-all font-mono-tight text-sm font-semibold text-highlighted">
                    {{ op.path }}
                  </code>
                  <p class="mt-1 text-sm text-muted">
                    {{ op.summary }}
                  </p>
                </div>
                <UBadge
                  :color="op.auth ? 'warning' : 'success'"
                  variant="outline"
                  size="sm"
                >
                  {{ op.auth ? $t('docs.needKey') : $t('docs.public') }}
                </UBadge>
              </div>

              <p
                v-if="op.description"
                class="text-sm leading-relaxed text-muted"
              >
                {{ op.description }}
              </p>

              <div v-if="op.params.length" class="space-y-2">
                <h4 class="text-xs font-bold uppercase tracking-wide text-muted">
                  {{ $t('docs.parameters') }}
                </h4>
                <div class="overflow-x-auto rounded-lg border border-default">
                  <table class="w-full text-left text-sm">
                    <thead class="bg-elevated/60 text-xs uppercase text-muted">
                      <tr>
                        <th class="px-3 py-2 font-semibold">
                          {{ $t('docs.paramName') }}
                        </th>
                        <th class="px-3 py-2 font-semibold">
                          {{ $t('docs.paramIn') }}
                        </th>
                        <th class="px-3 py-2 font-semibold">
                          {{ $t('docs.paramRequired') }}
                        </th>
                        <th class="px-3 py-2 font-semibold">
                          {{ $t('docs.paramType') }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="p in op.params"
                        :key="`${p.in}-${p.name}`"
                        class="border-t border-default"
                      >
                        <td class="px-3 py-2 font-mono-tight font-medium">
                          {{ p.name }}
                        </td>
                        <td class="px-3 py-2 text-muted">
                          {{ p.in }}
                        </td>
                        <td class="px-3 py-2">
                          <UBadge
                            size="sm"
                            variant="subtle"
                            :color="p.required ? 'error' : 'neutral'"
                          >
                            {{ p.required ? $t('docs.yes') : $t('docs.no') }}
                          </UBadge>
                        </td>
                        <td class="px-3 py-2 font-mono-tight text-muted">
                          {{ p.schema?.enum ? p.schema.enum.join(' | ') : (p.schema?.type || '—') }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div v-if="op.bodyExample" class="space-y-2">
                <h4 class="text-xs font-bold uppercase tracking-wide text-muted">
                  {{ $t('docs.requestBody') }}
                </h4>
                <pre class="overflow-x-auto rounded-lg bg-elevated p-3 font-mono-tight text-xs leading-relaxed">{{ typeof op.bodyExample === 'string' ? op.bodyExample : JSON.stringify(op.bodyExample, null, 2) }}</pre>
              </div>

              <div v-if="op.responseExample" class="space-y-2">
                <h4 class="text-xs font-bold uppercase tracking-wide text-muted">
                  {{ $t('docs.responseExample') }}
                </h4>
                <pre class="overflow-x-auto rounded-lg bg-elevated p-3 font-mono-tight text-xs leading-relaxed">{{ JSON.stringify(op.responseExample, null, 2) }}</pre>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <h4 class="text-xs font-bold uppercase tracking-wide text-muted">
                    {{ $t('docs.curl') }}
                  </h4>
                  <UButton
                    size="xs"
                    variant="soft"
                    color="neutral"
                    icon="i-lucide-copy"
                    @click="copyText(op.curl.replaceAll(`'${op.path}'`, `'${hostHint}${op.path}'`))"
                  >
                    {{ $t('docs.copy') }}
                  </UButton>
                </div>
                <pre class="overflow-x-auto rounded-lg border border-default bg-default/40 p-3 font-mono-tight text-xs leading-relaxed text-highlighted">{{ op.curl.replaceAll(`'${op.path}'`, `'${hostHint}${op.path}'`) }}</pre>
              </div>
            </UCard>
          </div>
        </section>

        <UAlert
          v-if="!filtered.length"
          color="neutral"
          variant="subtle"
          :title="$t('docs.empty')"
          :description="$t('docs.emptyDesc')"
        />
      </div>

      <footer class="mt-12 border-t border-default py-6 text-center text-xs text-muted">
        {{ $t('docs.footer') }} ·
        <NuxtLink to="/v1/openapi.json" external class="text-primary hover:underline" target="_blank">
          openapi.json
        </NuxtLink>
      </footer>
    </template>
    </main>
  </div>
</template>
