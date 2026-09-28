import type { Component } from 'solid-js';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { appPageHeader, appPageTitle, appSectionLabel, appChannelRail } from '../../theme/appChrome';
import { MOBILE_TAB_BAR_HEIGHT } from './MobileTabBar';
import { incomingFriendRequests, notificationItems } from '../../lib/mobileNotifications';
import { friendDisplayName } from '../../stores/relationships';
import { ackRoomOptimistic } from '../../stores/readState';
import { openMobileRoom } from '../../stores/mobileShellLayout';
import { putRelationship, removeRelationship } from '../../api/relationships';
import { removeRelationshipLocally } from '../../stores/relationships';
import { t } from '../../i18n';

/** Notifications tab: everything waiting on you - mentions, unread conversations and
 * incoming friend requests - each row taking you straight to the thing it is about. */
export const MobileNotificationsPanel: Component = () => {
  const navigate = useNavigate();
  const items = createMemo(() => notificationItems());
  const requests = createMemo(() => incomingFriendRequests());
  const [busy, setBusy] = createSignal('');

  const empty = () => items().length === 0 && requests().length === 0;

  function open(href: string, roomId: string, lastMessageId: string | null) {
    if (lastMessageId) ackRoomOptimistic(roomId, lastMessageId);
    openMobileRoom();
    navigate(href);
  }

  async function respond(userId: string, accept: boolean) {
    setBusy(userId);
    try {
      if (accept) await putRelationship(userId);
      else await removeRelationship(userId);
      removeRelationshipLocally(userId);
    } catch (err) {
      console.error('Friend request action failed:', err);
    } finally {
      setBusy('');
    }
  }

  return (
    <section
      class={`flex w-screen shrink-0 flex-col overflow-hidden ${appChannelRail}`}
      style={{ 'padding-bottom': `calc(${MOBILE_TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))` }}
      aria-label={t('mobile.tabs.notifications')}
    >
      <div class={appPageHeader}>
        <h1 class={appPageTitle}>{t('mobile.tabs.notifications')}</h1>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <Show when={!empty()} fallback={<EmptyState icon="fa-solid fa-bell" body={t('mobile.notifications.empty')} />}>
          <Show when={requests().length > 0}>
            <h2 class={`${appSectionLabel} px-1 pb-1.5`}>{t('mobile.notifications.friendRequests')}</h2>
            <ul class="mb-4 space-y-2">
              <For each={requests()}>
                {(rel) => (
                  <li class="flex items-center gap-3 rounded-xl border border-border/70 bg-card/40 px-3 py-2.5">
                    <MessageAvatar name={friendDisplayName(rel)} avatar={rel.user.avatar} class="size-9 shrink-0 text-xs" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-foreground">{friendDisplayName(rel)}</p>
                      <p class="truncate text-xs text-muted-foreground">{t('mobile.notifications.wantsToBeFriends')}</p>
                    </div>
                    <div class="flex shrink-0 gap-1.5">
                      <Button size="sm" disabled={busy() === rel.user.id} onClick={() => void respond(rel.user.id, true)}>
                        {t('friends.actions.accept')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy() === rel.user.id}
                        onClick={() => void respond(rel.user.id, false)}
                      >
                        {t('friends.actions.decline')}
                      </Button>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>

          <Show when={items().length > 0}>
            <h2 class={`${appSectionLabel} px-1 pb-1.5`}>{t('mobile.notifications.recent')}</h2>
            <ul class="space-y-2">
              <For each={items()}>
                {(item) => (
                  <li>
                    <button
                      type="button"
                      class="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card/40 px-3 py-2.5 text-start transition-colors hover:bg-card/70"
                      onClick={() => open(item.href, item.roomId, item.lastMessageId)}
                    >
                      <Show
                        when={item.isChannel}
                        fallback={
                          <MessageAvatar name={item.name} avatar={item.avatar ?? undefined} class="size-9 shrink-0 text-xs" />
                        }
                      >
                        <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/40 text-muted-foreground">
                          <i class="fa-solid fa-hashtag text-xs" aria-hidden="true" />
                        </span>
                      </Show>
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p class="truncate text-xs text-muted-foreground">
                          {item.mention
                            ? t('mobile.notifications.mentioned', { count: item.count })
                            : t('mobile.notifications.unread', { count: item.count })}
                          <Show when={item.context}>
                            {' · '}
                            {item.context}
                          </Show>
                        </p>
                      </div>
                      <Show when={item.mention}>
                        <span class="shrink-0 rounded-full bg-destructive px-1.5 text-[11px] font-bold leading-5 text-destructive-foreground">
                          {item.count > 99 ? '99+' : item.count}
                        </span>
                      </Show>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Show>
      </div>
    </section>
  );
};
