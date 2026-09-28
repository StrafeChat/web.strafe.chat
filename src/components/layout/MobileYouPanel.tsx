import type { Component } from 'solid-js';
import { For, Show, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { PresenceDot } from '../PresenceDot';
import { auth } from '../../stores/auth';
import { presence, setUserPresence, type UserPresence } from '../../stores/presence';
import { patchMe } from '../../api/users';
import { openUserSettings } from '../../stores/userSettingsModal';
import { openMobileRoom, setMobileTab } from '../../stores/mobileShellLayout';
import { incomingFriendRequests } from '../../lib/mobileNotifications';
import { formatDiscriminator } from '../settings/types';
import { appChannelRail, appListRow, appListRowIdle, appPageHeader, appPageTitle, appSectionLabel } from '../../theme/appChrome';
import { MOBILE_TAB_BAR_HEIGHT } from './MobileTabBar';
import { t } from '../../i18n';

const STATUS_OPTIONS: { id: UserPresence['status']; labelKey: string; color: string }[] = [
  { id: 'online', labelKey: 'presence.online', color: 'bg-primary' },
  { id: 'idle', labelKey: 'presence.idle', color: 'bg-yellow-500' },
  { id: 'dnd', labelKey: 'presence.dnd', color: 'bg-red-500' },
  { id: 'invisible', labelKey: 'presence.invisible', color: 'bg-muted-foreground/50' },
];

/** You tab: identity, presence and the places that used to live in the desktop user dock
 * (friends, notes, settings) - Discord folded the Friends tab into this page too. */
export const MobileYouPanel: Component = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = createSignal(false);
  const userId = () => auth.user?.id ?? '';
  const me = () => (userId() ? presence.byUser[userId()] : undefined);
  const displayName = () => auth.user?.display_name || auth.user?.username || '';
  const handle = () => `${auth.user?.username ?? ''}#${formatDiscriminator(auth.user?.discriminator ?? 0)}`;
  const requestCount = () => incomingFriendRequests().length;

  async function setStatus(status: UserPresence['status']) {
    setUserPresence(userId(), { ...me(), status });
    setSaving(true);
    try {
      await patchMe({ presence: { status } });
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setSaving(false);
    }
  }

  function go(path: string) {
    // These are full pages, so they belong on the content side of the pager.
    openMobileRoom();
    setMobileTab('home');
    navigate(path);
  }

  return (
    <section
      class={`flex w-screen shrink-0 flex-col overflow-hidden ${appChannelRail}`}
      style={{ 'padding-bottom': `calc(${MOBILE_TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))` }}
      aria-label={t('mobile.tabs.you')}
    >
      <div class={`${appPageHeader} justify-between gap-2`}>
        <h1 class={appPageTitle}>{t('mobile.tabs.you')}</h1>
        <button
          type="button"
          class="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={t('common.settings')}
          onClick={() => openUserSettings()}
        >
          <i class="fa-solid fa-gear" aria-hidden="true" />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div class="flex items-center gap-3">
          <div class="relative shrink-0">
            <MessageAvatar name={displayName()} avatar={auth.user?.avatar} class="size-16 text-xl" />
            <span class="absolute -bottom-0.5 -right-0.5">
              <PresenceDot userId={userId()} class="size-4" />
            </span>
          </div>
          <div class="min-w-0">
            <p class="truncate text-lg font-semibold text-foreground">{displayName()}</p>
            <p class="truncate text-sm text-muted-foreground">{handle()}</p>
            <Show when={me()?.custom_status}>
              <p class="truncate text-xs text-muted-foreground/90">{me()!.custom_status}</p>
            </Show>
          </div>
        </div>

        <h2 class={`${appSectionLabel} mt-6 px-1 pb-1.5`}>{t('mobile.you.status')}</h2>
        <div class="grid grid-cols-2 gap-2">
          <For each={STATUS_OPTIONS}>
            {(opt) => {
              const active = () => (me()?.status ?? 'offline') === opt.id;
              return (
                <button
                  type="button"
                  aria-pressed={active()}
                  disabled={saving()}
                  class={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                    active()
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border/70 bg-card/40 text-muted-foreground hover:bg-card/70'
                  }`}
                  onClick={() => void setStatus(opt.id)}
                >
                  <span class={`size-2.5 shrink-0 rounded-full ${opt.color}`} />
                  {t(opt.labelKey)}
                </button>
              );
            }}
          </For>
        </div>

        <h2 class={`${appSectionLabel} mt-6 px-1 pb-1.5`}>{t('mobile.you.shortcuts')}</h2>
        <div class="flex flex-col gap-1">
          <button type="button" class={`${appListRow} ${appListRowIdle}`} onClick={() => go('/friends')}>
            <i class="fa-solid fa-user-group w-5 text-center text-sm text-muted-foreground" aria-hidden="true" />
            <span class="flex-1">{t('nav.friends')}</span>
            <Show when={requestCount() > 0}>
              <span class="rounded-full bg-destructive px-1.5 text-[11px] font-bold leading-5 text-destructive-foreground">
                {requestCount()}
              </span>
            </Show>
          </button>
          <button type="button" class={`${appListRow} ${appListRowIdle}`} onClick={() => go('/notes')}>
            <i class="fa-solid fa-note-sticky w-5 text-center text-sm text-muted-foreground" aria-hidden="true" />
            <span class="flex-1">{t('nav.notes')}</span>
          </button>
          <button type="button" class={`${appListRow} ${appListRowIdle}`} onClick={() => openUserSettings()}>
            <i class="fa-solid fa-gear w-5 text-center text-sm text-muted-foreground" aria-hidden="true" />
            <span class="flex-1">{t('common.settings')}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
