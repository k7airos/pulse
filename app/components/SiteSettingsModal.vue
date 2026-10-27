<script setup lang="ts">
export interface SiteSettings {
  id: string
  name: string
  domain: string | null
  timezone: string | null
  retentionDays: number | null
  shareId: string | null
}

const props = defineProps<{ site: SiteSettings, serverTz: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [], deleted: [] }>()

const { t } = useI18n()
const toast = useToast()
const { api, error } = usePulseAdmin()
const origin = useRequestURL().origin

const name = ref('')
const domain = ref('')
const timezone = ref<string>('')
const retention = ref<number | 'default'>('default')
const shareId = ref<string | null>(null)
const saving = ref(false)
const busy = ref('')
const confirmName = ref('')

// 浏览器内置的 IANA 时区列表；空串 = 跟随服务器
const tzItems = computed(() => {
  const list = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  return ['', ...list]
})

const retentionItems = computed(() => [
  { label: t('settings.retentionDefault'), value: 'default' as const },
  { label: t('settings.retentionForever'), value: 0 },
  { label: t('settings.retentionDays', { n: 30 }), value: 30 },
  { label: t('settings.retentionDays', { n: 90 }), value: 90 },
  { label: t('settings.retentionDays', { n: 180 }), value: 180 },
  { label: t('settings.retentionDays', { n: 365 }), value: 365 },
  { label: t('settings.retentionDays', { n: 730 }), value: 730 },
])

watch(open, (v) => {
  if (!v)
    return
  name.value = props.site.name
  domain.value = props.site.domain || ''
  timezone.value = props.site.timezone || ''
  retention.value = props.site.retentionDays === null ? 'default' : props.site.retentionDays
  shareId.value = props.site.shareId
  confirmName.value = ''
})

const tzChanged = computed(() => (timezone.value || props.serverTz) !== (props.site.timezone || props.serverTz))
const shareUrl = computed(() => shareId.value ? `${origin}/share/${shareId.value}` : '')

async function save() {
  saving.value = true
  try {
    await api(`/v1/websites/${props.site.id}`, {
      method: 'PATCH',
      body: {
        name: name.value.trim(),
        domain: domain.value.trim() || null,
        timezone: timezone.value || null,
        retentionDays: retention.value === 'default' ? null : retention.value,
      },
    })
    toast.add({ title: t('settings.saved'), color: 'success' })
    open.value = false
    emit('saved')
  }
  catch {
    toast.add({ title: t('settings.saveFail'), description: error.value, color: 'error' })
  }
  finally {
    saving.value = false
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

async function createShare() {
  busy.value = 'share'
  try {
    const r = await api<{ shareId: string }>(`/v1/websites/${props.site.id}/share`, { method: 'POST' })
    shareId.value = r.shareId
    emit('saved')
  }
  catch {
    toast.add({ title: t('settings.saveFail'), description: error.value, color: 'error' })
  }
  finally {
    busy.value = ''
  }
}

async function revokeShare() {
  busy.value = 'share'
  try {
    await api(`/v1/websites/${props.site.id}/share`, { method: 'DELETE' })
    shareId.value = null
    emit('saved')
  }
  catch {
    toast.add({ title: t('settings.saveFail'), description: error.value, color: 'error' })
  }
  finally {
    busy.value = ''
  }
}

// 清理与删除都要二次确认
const pruneArmed = ref(false)
async function pruneNow() {
  const days = retention.value === 'default' ? 0 : retention.value
  if (!days) {
    toast.add({ title: t('settings.pruneNeedDays'), color: 'warning' })
    return
  }
  if (!pruneArmed.value) {
    pruneArmed.value = true
    setTimeout(() => (pruneArmed.value = false), 4000)
    return
  }
  pruneArmed.value = false
  busy.value = 'prune'
  try {
    const r = await api<{ events: number }>(`/v1/websites/${props.site.id}/prune`, { method: 'POST', body: { days } })
    toast.add({ title: t('settings.pruned', { n: r.events }), color: 'success' })
    emit('saved')
  }
  catch {
    toast.add({ title: t('settings.saveFail'), description: error.value, color: 'error' })
  }
  finally {
    busy.value = ''
  }
}

async function removeSite() {
  if (confirmName.value !== props.site.name)
    return
  busy.value = 'delete'
  try {
    await api(`/v1/websites/${props.site.id}`, { method: 'DELETE' })
    toast.add({ title: t('settings.deleted'), color: 'neutral' })
    open.value = false
    emit('deleted')
  }
  catch {
    toast.add({ title: t('settings.saveFail'), description: error.value, color: 'error' })
  }
  finally {
    busy.value = ''
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="$t('settings.title')" :description="site.name">
    <template #body>
      <div class="space-y-5">
        <section class="space-y-3">
          <UFormField :label="$t('dashboard.name')">
            <UInput v-model="name" class="w-full" />
          </UFormField>
          <UFormField :label="$t('dashboard.domainOptional')" :hint="$t('dashboard.domainHint')">
            <UInput v-model="domain" class="w-full" placeholder="example.com" />
          </UFormField>
          <UFormField :label="$t('settings.timezone')" :hint="tzChanged ? $t('settings.tzRebuild') : $t('settings.tzHint', { tz: serverTz })">
            <USelectMenu
              v-model="timezone"
              :items="tzItems"
              class="w-full"
              :search-input="{ placeholder: $t('dashboard.search') }"
            >
              <template #default>
                {{ timezone || $t('settings.tzServer', { tz: serverTz }) }}
              </template>
              <template #item-label="{ item }">
                {{ item || $t('settings.tzServer', { tz: serverTz }) }}
              </template>
            </USelectMenu>
          </UFormField>
          <UFormField :label="$t('settings.retention')" :hint="$t('settings.retentionHint')">
            <div class="flex gap-2">
              <USelect v-model="retention" :items="retentionItems" class="w-56" />
              <UButton
                variant="outline"
                :color="pruneArmed ? 'error' : 'neutral'"
                icon="i-lucide-eraser"
                :loading="busy === 'prune'"
                @click="pruneNow"
              >
                {{ pruneArmed ? $t('site.revokeConfirm') : $t('settings.pruneNow') }}
              </UButton>
            </div>
          </UFormField>
        </section>

        <section class="space-y-2 border-t border-default pt-4">
          <h3 class="text-xs font-semibold text-highlighted">
            {{ $t('settings.share') }}
          </h3>
          <p class="text-xs text-muted">
            {{ $t('settings.shareHint') }}
          </p>
          <div v-if="shareId" class="flex items-center gap-1.5">
            <UInput :model-value="shareUrl" readonly class="font-mono-tight min-w-0 flex-1" />
            <UButton variant="outline" color="neutral" icon="i-lucide-copy" :aria-label="$t('docs.copy')" @click="copy(shareUrl)" />
            <UButton variant="outline" color="neutral" icon="i-lucide-refresh-cw" :loading="busy === 'share'" :aria-label="$t('settings.shareRotate')" :title="$t('settings.shareRotate')" @click="createShare" />
            <UButton variant="outline" color="error" icon="i-lucide-link-2-off" :loading="busy === 'share'" :aria-label="$t('settings.shareRevoke')" :title="$t('settings.shareRevoke')" @click="revokeShare" />
          </div>
          <UButton v-else variant="soft" color="neutral" icon="i-lucide-link" :loading="busy === 'share'" @click="createShare">
            {{ $t('settings.shareCreate') }}
          </UButton>
        </section>

        <section class="space-y-2 border-t border-default pt-4">
          <h3 class="text-xs font-semibold text-[var(--pulse-down)]">
            {{ $t('settings.danger') }}
          </h3>
          <p class="text-xs text-muted">
            {{ $t('settings.deleteHint', { name: site.name }) }}
          </p>
          <div class="flex gap-2">
            <UInput v-model="confirmName" :placeholder="site.name" class="min-w-0 flex-1" />
            <UButton
              color="error"
              variant="soft"
              icon="i-lucide-trash-2"
              :disabled="confirmName !== site.name"
              :loading="busy === 'delete'"
              @click="removeSite"
            >
              {{ $t('settings.delete') }}
            </UButton>
          </div>
        </section>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="open = false">
          {{ $t('dashboard.cancel') }}
        </UButton>
        <UButton color="primary" :loading="saving" :disabled="!name.trim()" @click="save">
          {{ $t('goals.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
