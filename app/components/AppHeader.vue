<script setup lang="ts">
defineProps<{ showLogout?: boolean, minimal?: boolean }>()
defineEmits<{ logout: [] }>()
</script>

<template>
  <header
    class="sticky top-0 z-30 flex h-11 items-center gap-2 border-b border-default bg-default/95 px-3 backdrop-blur sm:px-4"
  >
    <NuxtLink
      to="/"
      class="flex shrink-0 items-center gap-2 text-highlighted"
      :aria-label="$t('app.name')"
    >
      <span class="grid size-6 place-items-center rounded-md bg-[var(--brand)] text-[var(--on-brand)]">
        <UIcon name="i-lucide-activity" class="size-3.5" />
      </span>
      <span class="text-sm font-semibold tracking-tight">{{ $t('app.name') }}</span>
    </NuxtLink>

    <div class="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-muted">
      <slot name="crumb" />
    </div>

    <div class="flex shrink-0 items-center gap-0.5">
      <slot name="actions" />
      <UButton
        to="/docs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-book-open"
        :aria-label="$t('nav.docs')"
        class="hidden sm:inline-flex"
        v-if="!minimal"
      >
        <span class="hidden md:inline">{{ $t('nav.docs') }}</span>
      </UButton>
      <LocaleSwitcher />
      <UColorModeButton variant="ghost" color="neutral" />
      <UButton
        v-if="showLogout"
        variant="ghost"
        color="neutral"
        icon="i-lucide-log-out"
        :aria-label="$t('nav.logout')"
        @click="$emit('logout')"
      />
    </div>
  </header>
</template>
