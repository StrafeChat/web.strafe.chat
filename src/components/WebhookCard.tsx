import type { Component } from 'solid-js';
import { Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { MessageAvatar } from './messageList/MessageAvatar';
import { WebhookTag } from './WebhookTag';
import { closeWebhookCard, webhookCard } from '../stores/webhookCard';
import { findLoadedWebhook, refreshRoomWebhooks } from '../stores/webhooks';
import { roomBridges } from '../stores/bridges';
import { spaces } from '../stores/spaces';
import { spaceMembers } from '../stores/spaceMembers';
import { requestOpenExternalLink } from '../stores/externalLink';
import { canManageWebhooksIn } from '../lib/roomPerms';
import { bridgePlatformIcon, bridgePlatformLabel, nameSkeleton } from '../lib/bridgePlatforms';
import { confirmBlockBridgedUser } from '../lib/bridgeModeration';
import { resolveSpaceUser } from '../lib/spaceProfile';
import { appSectionLabel, zLayer } from '../theme/appChrome';
import { t } from '../i18n';

const WIDTH = 300;
const MARGIN = 8;
const GAP = 8;

/**
 * The card a webhook message's or a bridged message's name or avatar opens. Never a person's
 * profile: neither is an account, so nothing a person's card has (message, add friend, roles,
 * nickname, moderation of a member) is here.
 *
 * - Webhook: the name and avatar it was posted under, the WEBHOOK tag, the room it posts into
 *   and - for a viewer with Manage Webhooks there - who created it.
 * - Bridged person: "Alice on Discord", the platform tag, who really posted it (the bot that
 *   drives the bridge, one click away) and through which bridge, "Not the Strafe account @alice"
 *   when a member here has the same name, the profile link on the platform when the bridge
 *   allows it, and "Block from this bridge" for moderators. The external user id is never shown.
 *
 * Mounted once in the app shell; opened through stores/webhookCard.
 */
export const WebhookCard: Component = () => {
  const [root, setRoot] = createSignal<HTMLDivElement>();
  const [height, setHeight] = createSignal(220);
  const [blocked, setBlocked] = createSignal(false);
  const subject = () => webhookCard.subject;
  const bridge = () => subject()?.bridge;

  const roomName = createMemo(() => {
    const s = subject();
    if (!s?.spaceId || !s.roomId) return '';
    return spaces.spaceRoomsBySpaceId[s.spaceId]?.find((r) => r.id === s.roomId)?.name ?? '';
  });
  const canManage = createMemo(() => {
    const s = subject();
    return !!s && !s.bridge && canManageWebhooksIn(s.spaceId, s.roomId);
  });
  // The creator is only on the managers' list; load it when such a viewer opens the card.
  createEffect(() => {
    const s = subject();
    if (!s?.roomId || !canManage()) return;
    if (!findLoadedWebhook(s.webhookId)) void refreshRoomWebhooks(s.roomId).catch(() => undefined);
  });
  const webhook = createMemo(() => {
    const s = subject();
    return s && canManage() ? findLoadedWebhook(s.webhookId) : undefined;
  });
  const creatorName = () => {
    const c = webhook()?.creator;
    return c ? c.display_name || c.username : '';
  };

  // --- Bridged person ---
  const platform = () => {
    const b = bridge();
    return b ? bridgePlatformLabel(b.platform, b.platformName) : '';
  };
  /** The room's summary of this bridge, for its name and what it is bridged with. */
  const summary = createMemo(() => {
    const s = subject();
    const b = s?.bridge;
    if (!b) return undefined;
    return roomBridges(s.spaceId, s.roomId).find((x) => x.id === b.bridgeId);
  });
  const bridgeName = () => bridge()?.bridgeName || summary()?.name || '';
  /** The bot that really posted it, named from the space when the message did not. */
  const via = createMemo(() => {
    const s = subject();
    const v = s?.bridge?.via;
    if (!v) return undefined;
    const name = v.name || resolveSpaceUser(s.spaceId, v.id, undefined, '').name || summary()?.driver_name || '';
    return { id: v.id, name: name || t('bridges.card.theBot') };
  });
  /** A member here whose username, display name or nickname is the same name: the server's
   * verdict from when it was posted, else the member list this client holds. */
  const namesake = createMemo((): { id: string; username: string } | undefined => {
    const s = subject();
    if (!s?.bridge) return undefined;
    const fromServer = s.bridge.lookalike;
    if (fromServer?.id) {
      const m = s.spaceId ? spaceMembers.bySpaceId[s.spaceId]?.find((x) => x.id === fromServer.id) : undefined;
      return { id: fromServer.id, username: m?.username || fromServer.username || fromServer.id };
    }
    if (!s.spaceId) return undefined;
    const key = nameSkeleton(s.name);
    if (!key) return undefined;
    const members = spaceMembers.bySpaceId[s.spaceId] ?? [];
    const m = members.find(
      (x) =>
        !x.bot &&
        [x.username, x.display_name, (x as { nick?: string }).nick].some((n) => !!n && nameSkeleton(n) === key)
    );
    return m ? { id: m.id, username: m.username } : undefined;
  });

  async function block() {
    const s = subject();
    const b = s?.bridge;
    if (!s || !b || !s.puppetId) return;
    const done = await confirmBlockBridgedUser({
      bridgeId: b.bridgeId,
      puppetId: s.puppetId,
      name: s.name,
      platform: b.platform,
      platformName: b.platformName,
    });
    if (done) setBlocked(true);
  }

  function openUser(id: string, el: HTMLElement) {
    const open = subject()?.openUser;
    closeWebhookCard();
    open?.(id, el);
  }

  const position = createMemo(() => {
    const a = webhookCard.anchor;
    if (!a) return { left: MARGIN, top: MARGIN };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(MARGIN, Math.min(a.left, vw - WIDTH - MARGIN));
    const h = height();
    let top = a.bottom + GAP;
    if (top + h > vh - MARGIN) top = a.top - GAP - h >= MARGIN ? a.top - GAP - h : Math.max(MARGIN, vh - MARGIN - h);
    return { left, top };
  });

  createEffect(() => {
    if (!webhookCard.open) return;
    setBlocked(false);
    const el = root();
    if (el) queueMicrotask(() => setHeight(el.getBoundingClientRect().height));
    void webhook();
    void namesake();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeWebhookCard();
    };
    const onDown = (e: MouseEvent) => {
      if (root()?.contains(e.target as Node)) return;
      closeWebhookCard();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown, true);
    onCleanup(() => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown, true);
    });
  });

  return (
    <Show when={webhookCard.open && subject()}>
      {(s) => (
        <Portal>
          <div
            ref={setRoot}
            role="dialog"
            aria-label={s().name}
            data-webhook-card
            data-bridged-card={s().bridge ? '' : undefined}
            class={`fixed ${zLayer.popover} w-[300px] overflow-hidden rounded-2xl border border-border bg-popover/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl dialog-panel-in`}
            style={{ left: `${position().left}px`, top: `${position().top}px` }}
          >
            <div class="flex items-center gap-3">
              <MessageAvatar name={s().name} avatar={s().avatar} user={{ id: s().puppetId ?? s().webhookId }} class="size-14 text-xl" />
              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 items-center">
                  <span class="truncate text-base font-semibold text-foreground" style={s().colour ? { color: s().colour } : undefined}>
                    {s().name}
                  </span>
                  <WebhookTag webhook={s().bridge ? { kind: 'bridge', bridge: s().bridge } : true} size="sm" />
                </div>
                <Show
                  when={s().bridge}
                  fallback={
                    <Show when={roomName()}>
                      <p class="mt-0.5 truncate text-xs text-muted-foreground">{t('webhooks.card.inRoom', { room: roomName() })}</p>
                    </Show>
                  }
                >
                  <p class="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <i class={`${bridgePlatformIcon(bridge()?.platform)} text-[11px]`} aria-hidden="true" />
                    <span class="truncate">
                      {bridge()?.externalBot ? t('bridges.card.botOn', { platform: platform() }) : t('bridges.card.userOn', { platform: platform() })}
                    </span>
                  </p>
                </Show>
              </div>
            </div>

            <Show
              when={s().bridge}
              fallback={
                <div class="mt-3 space-y-2 border-t border-border/60 pt-3">
                  <p class="text-xs leading-snug text-muted-foreground">{t('webhooks.card.notAnAccount')}</p>
                  <Show when={webhook()}>
                    {(w) => (
                      <div class="space-y-1">
                        <p class={appSectionLabel}>{t('webhooks.card.webhookLabel')}</p>
                        <p class="text-sm text-foreground">
                          {w().name}
                          <Show when={creatorName()}>
                            <span class="text-muted-foreground"> · {t('webhooks.card.createdBy', { name: creatorName() })}</span>
                          </Show>
                        </p>
                      </div>
                    )}
                  </Show>
                </div>
              }
            >
              <div class="mt-3 space-y-2.5 border-t border-border/60 pt-3">
                <p class="text-sm leading-snug text-foreground">{t('bridges.card.headline', { name: s().name, platform: platform() })}</p>
                <div class="space-y-1">
                  <p class={appSectionLabel}>{t('bridges.card.bridgedBy')}</p>
                  <Show
                    when={via()}
                    fallback={<p class="text-sm text-foreground">{bridgeName() || t('bridges.card.unknownBridge')}</p>}
                  >
                    {(v) => (
                      <p class="flex min-w-0 flex-wrap items-center gap-x-1 text-sm text-foreground">
                        <button
                          type="button"
                          class="max-w-full truncate rounded font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-bridge-via
                          onClick={(e) => openUser(v().id, e.currentTarget)}
                        >
                          {v().name}
                        </button>
                        <Show when={bridgeName()}>
                          <span class="min-w-0 truncate text-muted-foreground">· {t('bridges.card.throughBridge', { name: bridgeName() })}</span>
                        </Show>
                      </p>
                    )}
                  </Show>
                  <Show when={summary()?.remote?.name}>
                    {(remote) => <p class="truncate text-xs text-muted-foreground">{t('bridges.card.remote', { remote: remote() })}</p>}
                  </Show>
                </div>
                <p class="text-xs leading-snug text-muted-foreground">{t('bridges.card.notAnAccount')}</p>
                <Show when={namesake()}>
                  {(m) => (
                    <p class="flex flex-wrap items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-foreground" data-bridge-namesake>
                      <i class="fa-solid fa-circle-info text-amber-500" aria-hidden="true" />
                      <span>{t('bridges.card.notTheMember')}</span>
                      <button
                        type="button"
                        class="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={(e) => openUser(m().id, e.currentTarget)}
                      >
                        @{m().username}
                      </button>
                    </p>
                  )}
                </Show>
                <Show when={bridge()?.profileUrl}>
                  {(url) => (
                    <button
                      type="button"
                      class="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => {
                        closeWebhookCard();
                        requestOpenExternalLink(url());
                      }}
                    >
                      <i class="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden="true" />
                      {t('bridges.card.openProfile', { platform: platform() })}
                    </button>
                  )}
                </Show>
                <Show when={s().canBlock && s().puppetId}>
                  <div class="border-t border-border/60 pt-2.5">
                    <Show
                      when={!blocked()}
                      fallback={
                        <p class="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                          <i class="fa-solid fa-check text-emerald-500" aria-hidden="true" />
                          {t('bridges.block.done', { name: s().name })}
                        </p>
                      }
                    >
                      <button
                        type="button"
                        class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        data-bridge-block
                        onClick={() => void block()}
                      >
                        <i class="fa-solid fa-user-slash text-[11px]" aria-hidden="true" />
                        {t('bridges.block.fromBridge')}
                      </button>
                    </Show>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </Portal>
      )}
    </Show>
  );
};
