import type { Component } from 'solid-js';
import { For, Show, createMemo } from 'solid-js';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { PresenceDot } from '../PresenceDot';
import { auth } from '../../stores/auth';
import { notificationBadgeCount } from '../../lib/mobileNotifications';
import { mobileTab, setMobileTab, type MobileTab } from '../../stores/mobileShellLayout';
import { appHeaderBar } from '../../theme/appChrome';
import { t } from '../../i18n';

export interface MobileTabBarProps {
  /** 0 while the nav panel is fully on screen, 1 once it has been swiped away - the bar
   * fades and slides out with the panel it belongs to. */
  progress: number;
  /** Suppress the transition while a finger is dragging so the bar tracks it. */
  dragging: boolean;
}

const TABS: { id: MobileTab; icon: string; labelKey: string }[] = [
  { id: 'home', icon: 'fa-solid fa-house', labelKey: 'nav.home' },
  { id: 'notifications', icon: 'fa-solid fa-bell', labelKey: 'mobile.tabs.notifications' },
  { id: 'you', icon: '', labelKey: 'mobile.tabs.you' },
];

/** Height reserved for the bar, so the panels above it can pad themselves out of its way. */
export const MOBILE_TAB_BAR_HEIGHT = '4rem';

/**
 * Discord-style bottom navigation: Home, Notifications, You. It belongs to the nav panel
 * only - open a room and it goes away, leaving the whole screen to the conversation.
 */
export const MobileTabBar: Component<MobileTabBarProps> = (props) => {
  const badge = createMemo(() => notificationBadgeCount());
  const displayName = () => auth.user?.display_name || auth.user?.username || '';
  const hidden = () => props.progress > 0.99;

  return (
    <nav
      aria-label={t('mobile.tabs.aria')}
      class={`fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border ${appHeaderBar} pb-[env(safe-area-inset-bottom)] md:hidden ${
        props.dragging ? '' : 'transition-[opacity,transform] duration-200 ease-out'
      }`}
      style={{
        height: `calc(${MOBILE_TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))`,
        opacity: `${1 - props.progress}`,
        transform: `translate3d(0, ${props.progress * 100}%, 0)`,
        'pointer-events': hidden() ? 'none' : 'auto',
        visibility: hidden() ? 'hidden' : 'visible',
      }}
    >
      <For each={TABS}>
        {(tab) => {
          const active = () => mobileTab() === tab.id;
          return (
            <button
              type="button"
              aria-current={active() ? 'page' : undefined}
              class={`relative flex flex-1 flex-col items-center justify-center gap-1 pt-1 text-[11px] font-medium transition-colors ${
                active() ? 'text-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => setMobileTab(tab.id)}
            >
              <span class="relative flex h-6 items-center justify-center">
                <Show
                  when={tab.id === 'you'}
                  fallback={<i class={`${tab.icon} text-[17px]`} aria-hidden="true" />}
                >
                  <span class="relative">
                    <MessageAvatar
                      name={displayName()}
                      avatar={auth.user?.avatar}
                      class={`size-6 text-[9px] ${active() ? 'ring-2 ring-primary' : ''}`}
                    />
                    <span class="absolute -bottom-0.5 -right-0.5">
                      <PresenceDot userId={auth.user?.id ?? ''} class="size-2.5" />
                    </span>
                  </span>
                </Show>
                <Show when={tab.id === 'notifications' && badge() > 0}>
                  <span class="absolute -right-3 -top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-4 text-destructive-foreground">
                    {badge() > 99 ? '99+' : badge()}
                  </span>
                </Show>
              </span>
              {t(tab.labelKey)}
              <Show when={active()}>
                <span class="absolute inset-x-6 top-0 h-0.5 rounded-b-full bg-primary" />
              </Show>
            </button>
          );
        }}
      </For>
    </nav>
  );
};
