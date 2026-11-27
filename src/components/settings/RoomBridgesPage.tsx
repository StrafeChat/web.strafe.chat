import type { Component } from 'solid-js';
import { For, Show, createEffect, createMemo, createSignal, on } from 'solid-js';
import {
  deleteBridge,
  listBridgeBlocks,
  patchBridge,
  unblockBridgedUser,
  type Bridge,
  type BridgeBlock,
  type BridgeSettings,
  type BridgeSummary,
  type PatchBridgeInput,
} from '../../api/bridges';
import { isApiError } from '../../api/ApiError';
import { bridges, forgetBridge, loadBridge, putBridge, refreshRoomBridges, roomBridges } from '../../stores/bridges';
import { confirmDialog } from '../../stores/confirmDialog';
import { requestOpenExternalLink } from '../../stores/externalLink';
import { translateCaughtApiError } from '../../lib/formatApiError';
import { bridgePlatformIcon, bridgePlatformLabel, BRIDGES_LEARN_MORE } from '../../lib/bridgePlatforms';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { EmptyState } from '../ui/EmptyState';
import { settingsSectionTitle } from './settingsChrome';
import { formatDate, t } from '../../i18n';

interface Props {
  spaceId: string;
  roomId: string;
  /** Manage Webhooks in this room: change a bridge's settings, pause, resume, remove it. */
  canManage: boolean;
  /** Manage Roles: only then may a bridge's people carry name colours (D-11). */
  canManageRoles: boolean;
  /** Kick Members, or Manage Messages here: block and unblock bridged people. */
  canModerate: boolean;
  /** The room is end-to-end encrypted: its bridges are off while it is. */
  encrypted: boolean;
}

/** The switches a manager may flip, in the order the page shows them. */
const SETTING_KEYS: (keyof BridgeSettings)[] = ['reply_pings', 'relay_bots', 'relay_other_bridges', 'allow_colour', 'show_profile_links'];

const KNOWN_REASONS = ['paused_by_manager', 'paused_by_driver', 'became_private', 'driver_lost_permission', 'encrypted'];

/**
 * Room settings > Integrations > Bridges: what this room is bridged with and the managers'
 * controls over it (spec 14). A bridge is added by the bot that runs it (Strife's /bridge, a
 * strafe.js `room.createBridge`), never from here; here a manager sees its platform, what it
 * declares it is bridged with, the bot and its state, changes its settings (reply pings, which
 * messages it copies, name colours - Manage Roles - and profile links), pauses or resumes it
 * (with the private-room acknowledgement when the room is not open to everyone), lists and
 * lifts the blocks on bridged people, and removes it (the room gets the "unbridged" notice).
 */
export const RoomBridgesPage: Component<Props> = (props) => {
  const [loadErr, setLoadErr] = createSignal('');
  const [err, setErr] = createSignal('');
  const [busyId, setBusyId] = createSignal<string | null>(null);
  const [openBlocks, setOpenBlocks] = createSignal<string | null>(null);
  const [blocks, setBlocks] = createSignal<Record<string, BridgeBlock[] | undefined>>({});
  const [blocksErr, setBlocksErr] = createSignal('');

  createEffect(
    on(
      () => [props.roomId, props.canManage] as const,
      ([roomId, can]) => {
        setLoadErr('');
        setErr('');
        setOpenBlocks(null);
        setBlocks({});
        if (!roomId) return;
        void refreshRoomBridges(roomId, props.spaceId)
          .then((list) => {
            // The full objects (settings, who added it) are for the room's managers.
            if (can) for (const b of list) void loadBridge(b.id).catch(() => undefined);
          })
          .catch((e) => setLoadErr(errorText(e)));
      }
    )
  );

  const list = createMemo(() => roomBridges(props.spaceId, props.roomId));

  function errorText(e: unknown): string {
    return translateCaughtApiError(e, t).join(' ');
  }

  const full = (b: BridgeSummary): Bridge | undefined => bridges.full[b.id];
  const settingsOf = (b: BridgeSummary): BridgeSettings | undefined => full(b)?.settings;
  const creatorName = (b: BridgeSummary) => {
    const c = full(b)?.creator;
    return c ? c.display_name || c.username : '';
  };

  const stateReason = (b: BridgeSummary): string => {
    if (b.state === 'active') return '';
    const r = b.state_reason ?? '';
    return KNOWN_REASONS.includes(r) ? t(`bridges.state.reason.${r}`) : t(b.state === 'disabled' ? 'bridges.state.disabled' : 'bridges.state.paused');
  };

  /** PATCH, and when the room is not open to everyone, ask for the acknowledgement once
   * (409 private_room_ack_required names how many can see it) and try again with it. */
  async function patch(b: BridgeSummary, body: PatchBridgeInput): Promise<void> {
    if (busyId()) return;
    setBusyId(b.id);
    setErr('');
    try {
      putBridge(await patchBridge(b.id, body));
    } catch (e) {
      if (isApiError(e) && e.code === 'private_room_ack_required' && !body.acknowledge_private) {
        const audience = Number(e.body?.audience);
        const ok = await confirmDialog({
          title: t('bridges.manage.privateTitle'),
          body: Number.isFinite(audience) && audience > 0
            ? t('bridges.manage.privateBody', { count: audience, platform: bridgePlatformLabel(b.platform, b.platform_name) })
            : t('bridges.manage.privateBodyNoCount', { platform: bridgePlatformLabel(b.platform, b.platform_name) }),
          confirmLabel: t('bridges.manage.privateConfirm'),
          tone: 'danger',
          icon: 'fa-solid fa-lock',
        });
        if (ok) {
          try {
            putBridge(await patchBridge(b.id, { ...body, acknowledge_private: true }));
          } catch (e2) {
            setErr(errorText(e2));
          }
        }
      } else {
        setErr(errorText(e));
      }
    } finally {
      setBusyId(null);
    }
  }

  function setSetting(b: BridgeSummary, key: keyof BridgeSettings, on: boolean) {
    void patch(b, { settings: { [key]: on } });
  }

  async function remove(b: BridgeSummary) {
    const platform = bridgePlatformLabel(b.platform, b.platform_name);
    const ok = await confirmDialog({
      title: t('bridges.manage.removeTitle', { platform }),
      body: t('bridges.manage.removeBody', { platform }),
      confirmLabel: t('bridges.manage.remove'),
      tone: 'danger',
      icon: 'fa-solid fa-bridge-circle-xmark',
    });
    if (!ok) return;
    setBusyId(b.id);
    setErr('');
    try {
      await deleteBridge(b.id);
      forgetBridge(b.id, props.roomId);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleBlocks(b: BridgeSummary) {
    if (openBlocks() === b.id) {
      setOpenBlocks(null);
      return;
    }
    setOpenBlocks(b.id);
    setBlocksErr('');
    try {
      const rows = await listBridgeBlocks(b.id);
      setBlocks((prev) => ({ ...prev, [b.id]: rows }));
    } catch (e) {
      setBlocksErr(errorText(e));
    }
  }

  async function unblock(b: BridgeSummary, row: BridgeBlock) {
    setBusyId(b.id);
    setBlocksErr('');
    try {
      await unblockBridgedUser(b.id, row.puppet_id);
      setBlocks((prev) => ({ ...prev, [b.id]: (prev[b.id] ?? []).filter((x) => x.puppet_id !== row.puppet_id) }));
    } catch (e) {
      setBlocksErr(errorText(e));
    } finally {
      setBusyId(null);
    }
  }

  const blockedByName = (row: BridgeBlock) => {
    const by = row.blocked_by;
    if (!by) return '';
    if (typeof by === 'string') return '';
    return by.display_name || by.username || '';
  };

  return (
    <section class="max-w-2xl space-y-3" data-room-bridges>
      <h3 class={settingsSectionTitle}>{t('bridges.manage.title')}</h3>
      <p class="text-sm text-muted-foreground">
        {t('bridges.manage.intro')}{' '}
        <a href={BRIDGES_LEARN_MORE} target="_blank" rel="noopener" class="text-primary hover:underline">
          {t('bridges.learnMore')}
        </a>
      </p>

      <Show when={props.encrypted && list().length > 0}>
        <div class="flex gap-2.5 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-sm text-foreground/90" role="note">
          <i class="fa-solid fa-lock mt-0.5 text-muted-foreground" aria-hidden="true" />
          <span>{t('bridges.manage.encryptedRoom')}</span>
        </div>
      </Show>

      <Show when={err()}>
        <p class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{err()}</p>
      </Show>
      <Show when={loadErr()}>
        <p class="text-sm text-destructive">{loadErr()}</p>
      </Show>

      <Show when={list().length === 0 && !loadErr()}>
        <EmptyState icon="fa-solid fa-bridge" title={t('bridges.manage.emptyTitle')} body={t('bridges.manage.emptyBody')} />
      </Show>

      <div class="space-y-2">
        <For each={list()}>
          {(b) => {
            const platform = () => bridgePlatformLabel(b.platform, b.platform_name);
            const busy = () => busyId() === b.id;
            return (
              <div class="rounded-xl border border-border/70 bg-card/10" data-bridge-row={b.id}>
                <div class="flex items-start gap-3 px-3 py-3">
                  <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                    <i class={`${bridgePlatformIcon(b.platform)} text-base`} aria-hidden="true" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span class="min-w-0 max-w-full truncate text-sm font-semibold text-foreground">{platform()}</span>
                      <Show when={b.name}>
                        <span class="min-w-0 truncate text-sm text-muted-foreground">· {b.name}</span>
                      </Show>
                      <span
                        class={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          b.state === 'active'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                        data-bridge-state={b.state}
                      >
                        {b.state === 'active' ? t('bridges.state.active') : b.state === 'disabled' ? t('bridges.state.disabled') : t('bridges.state.paused')}
                      </span>
                    </div>
                    <Show when={b.remote?.name}>
                      {(remote) => (
                        <p class="mt-0.5 text-xs text-muted-foreground">
                          {t('bridges.panel.remote')}{' '}
                          <Show when={b.remote?.url} fallback={<span class="font-medium text-foreground">{remote()}</span>}>
                            {(url) => (
                              <button type="button" class="font-medium text-primary hover:underline" onClick={() => requestOpenExternalLink(url())}>
                                {remote()}
                              </button>
                            )}
                          </Show>{' '}
                          <span class="text-muted-foreground/80">({t('bridges.manage.selfDeclaredShort')})</span>
                        </p>
                      )}
                    </Show>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      <i class="fa-solid fa-robot me-1 text-[10px]" aria-hidden="true" />
                      {b.driver_name ? t('bridges.panel.runBy', { bot: b.driver_name }) : t('bridges.panel.runByBot')}
                      <Show when={b.created_at}>
                        {(when) => (
                          <>
                            {' · '}
                            <Show when={creatorName(b)} fallback={t('bridges.manage.addedOn', { when: formatDate(when(), { dateStyle: 'medium' }) })}>
                              {t('bridges.manage.addedByOn', { name: creatorName(b), when: formatDate(when(), { dateStyle: 'medium' }) })}
                            </Show>
                          </>
                        )}
                      </Show>
                    </p>
                    <Show when={stateReason(b)}>
                      <p class="mt-1 text-xs text-amber-600 dark:text-amber-400" data-bridge-reason>{stateReason(b)}</p>
                    </Show>
                  </div>
                </div>

                <Show when={props.canManage}>
                  <div class="space-y-1 border-t border-border/60 px-3 py-2.5">
                    <Show
                      when={settingsOf(b)}
                      fallback={<p class="py-1 text-xs text-muted-foreground">{t('bridges.manage.loadingSettings')}</p>}
                    >
                      {(st) => (
                        <For each={SETTING_KEYS}>
                          {(key) => {
                            const on = () => st()[key] === true;
                            // Turning colours on needs Manage Roles; turning them off never does.
                            const locked = () => key === 'allow_colour' && !props.canManageRoles && !on();
                            return (
                              <div class="flex items-center justify-between gap-4 rounded-lg px-1 py-1.5" data-bridge-setting={key}>
                                <div class="min-w-0">
                                  <p class="text-sm font-medium text-foreground">{t(`bridges.settings.${key}.title`)}</p>
                                  <p class="text-xs leading-snug text-muted-foreground">
                                    {locked() ? t('bridges.settings.allow_colour.needsPermission') : t(`bridges.settings.${key}.description`, { platform: platform() })}
                                  </p>
                                </div>
                                <Toggle
                                  checked={on()}
                                  disabled={busy() || locked()}
                                  label={t(`bridges.settings.${key}.title`)}
                                  onChange={(v) => setSetting(b, key, v)}
                                />
                              </div>
                            );
                          }}
                        </For>
                      )}
                    </Show>
                  </div>
                </Show>

                <Show when={props.canManage || props.canModerate}>
                  <div class="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-2.5">
                    <Show when={props.canManage}>
                      <Show
                        when={b.state === 'active'}
                        fallback={
                          <Show when={b.state === 'paused' && b.state_reason !== 'driver_lost_permission'}>
                            <Button type="button" size="sm" variant="secondary" disabled={busy() || props.encrypted} onClick={() => void patch(b, { state: 'active' })}>
                              <i class="fa-solid fa-play me-1.5 text-[10px]" aria-hidden="true" />
                              {t('bridges.manage.resume')}
                            </Button>
                          </Show>
                        }
                      >
                        <Button type="button" size="sm" variant="secondary" disabled={busy()} onClick={() => void patch(b, { state: 'paused' })}>
                          <i class="fa-solid fa-pause me-1.5 text-[10px]" aria-hidden="true" />
                          {t('bridges.manage.pause')}
                        </Button>
                      </Show>
                    </Show>
                    <Show when={props.canModerate}>
                      <Button type="button" size="sm" variant="outline" disabled={busy()} onClick={() => void toggleBlocks(b)} aria-expanded={openBlocks() === b.id}>
                        <i class="fa-solid fa-user-slash me-1.5 text-[10px]" aria-hidden="true" />
                        {t('bridges.manage.blocks')}
                      </Button>
                    </Show>
                    <Show when={props.canManage}>
                      <button
                        type="button"
                        class="ms-auto inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                        disabled={busy()}
                        data-bridge-remove
                        onClick={() => void remove(b)}
                      >
                        <i class="fa-solid fa-trash me-1.5 text-[10px]" aria-hidden="true" />
                        {t('bridges.manage.remove')}
                      </button>
                    </Show>
                  </div>
                </Show>

                <Show when={openBlocks() === b.id}>
                  <div class="space-y-2 border-t border-border/60 px-3 py-2.5" data-bridge-blocks={b.id}>
                    <p class="text-xs text-muted-foreground">{t('bridges.manage.blocksHint', { platform: platform() })}</p>
                    <Show when={blocksErr()}>
                      <p class="text-xs text-destructive" role="alert">{blocksErr()}</p>
                    </Show>
                    <Show
                      when={blocks()[b.id]}
                      fallback={<p class="text-xs text-muted-foreground">{t('common.loading')}</p>}
                    >
                      {(rows) => (
                        <Show when={rows().length > 0} fallback={<p class="text-xs text-muted-foreground">{t('bridges.manage.noBlocks')}</p>}>
                          <ul class="space-y-1.5">
                            <For each={rows()}>
                              {(row) => (
                                <li class="flex items-center gap-2.5 rounded-lg bg-muted/20 px-2.5 py-2" data-bridge-block-row={row.puppet_id}>
                                  <MessageAvatar name={row.name || '?'} avatar={row.avatar ?? undefined} user={{ id: row.puppet_id }} class="size-7 text-[10px]" />
                                  <div class="min-w-0 flex-1">
                                    <p class="truncate text-sm font-medium text-foreground">
                                      {row.name || t('bridges.manage.unnamedPuppet')}{' '}
                                      <span class="text-xs font-normal text-muted-foreground">({platform()})</span>
                                    </p>
                                    <p class="truncate text-xs text-muted-foreground">
                                      <Show when={row.blocked_at}>
                                        {(when) => (
                                          <Show when={blockedByName(row)} fallback={t('bridges.manage.blockedOn', { when: formatDate(when(), { dateStyle: 'medium' }) })}>
                                            {t('bridges.manage.blockedByOn', { name: blockedByName(row), when: formatDate(when(), { dateStyle: 'medium' }) })}
                                          </Show>
                                        )}
                                      </Show>
                                      <Show when={row.reason}>
                                        {(r) => <span> · {r()}</span>}
                                      </Show>
                                    </p>
                                  </div>
                                  <Button type="button" size="sm" variant="outline" disabled={busy()} onClick={() => void unblock(b, row)}>
                                    {t('bridges.manage.unblock')}
                                  </Button>
                                </li>
                              )}
                            </For>
                          </ul>
                        </Show>
                      )}
                    </Show>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </section>
  );
};
