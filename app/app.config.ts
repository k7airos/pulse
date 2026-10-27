// 浮层 portal 到 body；统一抬高，避免被 Modal 内容盖住。
const floatingZ = 'z-[70]'

const menuSlots = {
  content: `${floatingZ} min-w-40 rounded-lg shadow-[var(--family-shadow-panel)]`,
  group: 'p-1',
  item: 'min-h-8 items-center px-2.5 text-sm',
  itemTrailingIcon: 'size-4',
}

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand', // @akairos/design/tailwind.css 提供色阶
      neutral: 'zinc',
    },
    icons: { dynamic: true },
    // 工作台 compact 密度：控件 36px，按压反馈来自设计包 .family-action
    button: {
      slots: { base: 'family-action family-control' },
      variants: {
        size: {
          xs: { base: 'px-2 py-1 text-xs gap-1', leadingIcon: 'size-3.5', trailingIcon: 'size-3.5' },
          sm: { base: 'px-3 py-1.5 text-[13px] gap-1.5', leadingIcon: 'size-4', trailingIcon: 'size-4' },
          md: { base: 'px-3 py-1.5 text-sm gap-1.5', leadingIcon: 'size-4', trailingIcon: 'size-4' },
        },
      },
      defaultVariants: { size: 'sm' },
    },
    input: { slots: { base: 'family-control' } },
    dropdownMenu: { slots: menuSlots },
    popover: { slots: { content: floatingZ } },
    tooltip: { slots: { content: floatingZ } },
    modal: { variants: { fullscreen: { false: { content: 'rounded-xl' } } } },
    card: {
      slots: { root: 'rounded-lg', header: 'px-3 py-2 sm:px-4', body: 'p-3 sm:p-4' },
    },
    toast: {
      slots: {
        root: 'w-fit max-w-full mx-auto min-h-8 px-3 py-1.5 gap-2 bg-default shadow-sm rounded-full ring ring-default items-center',
        wrapper: 'w-auto min-w-0 flex-initial',
        title: 'text-xs font-medium leading-5',
        description: 'text-xs leading-5',
        icon: 'size-3.5',
        close: 'size-5 min-h-5 min-w-5 p-0 self-center rounded-full',
      },
    },
    toaster: {
      slots: { viewport: 'w-[calc(100%-2rem)] top-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:w-96' },
    },
  },
})
