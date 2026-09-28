import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { auth } from '../../stores/auth';
import {
  MAX_USER_VOLUME,
  disconnectMember,
  moveMember,
  serverDeafen,
  serverMute,
  setUserLocalMuted,
  setUserVolume,
  voice,
  voiceStatesForRoom,
} from '../../stores/voice';
import { spaces } from '../../stores/spaces';
import { voicePermsFor, voiceParticipantName } from '../../lib/voice/perms';
import { appMenuItemDanger, appMenuItemDefault, appMenuPanel, appMenuSeparator, zLayer } from '../../theme/appChrome';
import { t } from '../../i18n';

const ROOM_TYPE_VOICE = 4;
const EDGE = 8;

interface MenuTarget {
  userId: string;
  roomId: string;
  spaceId?: string;
}

const [target, setTarget] = createSignal<(MenuTarget & { x: number; y: number }) | null>(null);

/** Open the per-user voice menu (volume, local mute, moderation) at the pointer. */
export function openVoiceUserMenu(e: MouseEvent, tgt: MenuTarget): void {
  e.preventDefault();
  e.stopPropagation();
  setTarget({ ...tgt, x: e.clientX, y: e.clientY });
}

export function closeVoiceUserMenu(): void {
  setTarget(null);
}

/**
 * Discord's right-click on a voice participant: a volume slider and a local mute for
 * anyone, and - in a space room, when the viewer holds the permission - server mute /
 * deafen, move to another voice room, and disconnect.
 */
export const VoiceUserMenu: Component = () => {
  let panel: HTMLDivElement | undefined;
  const [pos, setPos] = createSignal<{ left: number; top: number } | null>(null);
  const [moveOpen, setMoveOpen] = createSignal(false);
  const [busy, setBusy] = createSignal(false);

  const me = () => auth.user?.id;
  const isSelf = () => target()?.userId === me();
  const state = createMemo(() => {
    const tg = target();
    if (!tg) return undefined;
    return voiceStatesForRoom(tg.roomId).find((s) => s.user_id === tg.userId);
  });
  const name = () => {
    const tg = target();
    return tg ? voiceParticipantName(tg.userId, state(), tg.spaceId) : '';
  };
  const perms = createMemo(() => {
    const tg = target();
    return voicePermsFor(me(), tg?.spaceId, tg?.roomId);
  });
  const ownerId = () => spaces.spaces.find((s) => s.id === target()?.spaceId)?.owner_id;
  /** Nobody but the owner moderates the owner. */
  const canModerateTarget = () => !isSelf() && (target()?.userId !== ownerId() || me() === ownerId());
  const showModeration = () => !!target()?.spaceId && canModerateTarget() && (perms().muteMembers || perms().deafenMembers || perms().moveMembers);
  const otherVoiceRooms = createMemo(() => {
    const tg = target();
    if (!tg?.spaceId) return [];
    return (spaces.spaceRoomsBySpaceId[tg.spaceId] ?? []).filter((r) => r.type === ROOM_TYPE_VOICE && r.id !== tg.roomId);
  });
  const volume = () => voice.userVolumes[target()?.userId ?? ''] ?? 100;
  const localMuted = () => !!voice.localMuted[target()?.userId ?? ''];

  function place() {
    const tg = target();
    const el = panel;
    if (!tg || !el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(EDGE, Math.min(tg.x, window.innerWidth - width - EDGE)),
      top: Math.max(EDGE, Math.min(tg.y, window.innerHeight - height - EDGE)),
    });
  }

  createEffect(() => {
    if (!target()) {
      setPos(null);
      setMoveOpen(false);
      return;
    }
    setPos(null);
    requestAnimationFrame(place);
    const onDocClick = (e: MouseEvent) => {
      if (panel?.contains(e.target as Node)) return;
      closeVoiceUserMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeVoiceUserMenu();
    };
    const onReflow = () => closeVoiceUserMenu();
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReflow);
    onCleanup(() => {
      document.removeEventListener('mousedown', onDocClick, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReflow);
    });
  });

  // The target left the room: nothing to act on.
  createEffect(() => {
    if (target() && !state()) closeVoiceUserMenu();
  });

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      closeVoiceUserMenu();
    } catch (err) {
      console.error('Voice moderation failed:', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={target()}>
      {(tg) => (
        <Portal mount={document.body}>
          <div
            ref={(el) => {
              panel = el;
            }}
            id="voice-user-menu"
            role="menu"
            aria-label={name()}
            class={`fixed ${zLayer.popover} w-64 ${appMenuPanel}`}
            style={{
              left: `${pos()?.left ?? -9999}px`,
              top: `${pos()?.top ?? -9999}px`,
              visibility: pos() ? 'visible' : 'hidden',
            }}
          >
            <div class="px-3 pb-1 pt-1.5 text-sm font-semibold text-foreground">{name()}</div>
            <Show when={!isSelf()}>
              <div class="px-3 py-1.5">
                <label class="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>{t('voice.menu.volume')}</span>
                  <span class="font-mono text-[11px] normal-case tracking-normal">{volume()}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={MAX_USER_VOLUME}
                  step={1}
                  value={volume()}
                  class="mt-1.5 w-full accent-primary"
                  aria-label={t('voice.menu.volume')}
                  onInput={(e) => setUserVolume(tg().userId, Number(e.currentTarget.value))}
                />
              </div>
              <button type="button" role="menuitemcheckbox" aria-checked={localMuted()} class={appMenuItemDefault} onClick={() => setUserLocalMuted(tg().userId, !localMuted())}>
                <i class={`fa-solid ${localMuted() ? 'fa-volume-high' : 'fa-volume-xmark'} w-4 text-center text-muted-foreground`} aria-hidden="true" />
                {localMuted() ? t('voice.menu.unmuteLocal') : t('voice.menu.muteLocal')}
              </button>
            </Show>
            <Show when={showModeration()}>
              <div class={appMenuSeparator} role="separator" />
              <Show when={perms().muteMembers}>
                <button
                  type="button"
                  role="menuitem"
                  class={appMenuItemDefault}
                  disabled={busy()}
                  onClick={() => void run(() => serverMute(tg().spaceId!, tg().userId, !state()?.mute))}
                >
                  <i class="fa-solid fa-microphone-slash w-4 text-center text-muted-foreground" aria-hidden="true" />
                  {state()?.mute ? t('voice.menu.serverUnmute') : t('voice.menu.serverMute')}
                </button>
              </Show>
              <Show when={perms().deafenMembers}>
                <button
                  type="button"
                  role="menuitem"
                  class={appMenuItemDefault}
                  disabled={busy()}
                  onClick={() => void run(() => serverDeafen(tg().spaceId!, tg().userId, !state()?.deaf))}
                >
                  <i class="fa-solid fa-volume-xmark w-4 text-center text-muted-foreground" aria-hidden="true" />
                  {state()?.deaf ? t('voice.menu.serverUndeafen') : t('voice.menu.serverDeafen')}
                </button>
              </Show>
              <Show when={perms().moveMembers && otherVoiceRooms().length > 0}>
                <button type="button" role="menuitem" aria-expanded={moveOpen()} class={`${appMenuItemDefault} justify-between`} onClick={() => setMoveOpen((o) => !o)}>
                  <span class="flex items-center gap-2.5">
                    <i class="fa-solid fa-arrow-right-arrow-left w-4 text-center text-muted-foreground" aria-hidden="true" />
                    {t('voice.menu.move')}
                  </span>
                  <i class={`fa-solid fa-chevron-right text-xs text-muted-foreground transition-transform ${moveOpen() ? 'rotate-90' : ''}`} aria-hidden="true" />
                </button>
                <Show when={moveOpen()}>
                  <div class="my-1 max-h-48 space-y-0.5 overflow-y-auto rounded-xl bg-muted/25 p-1">
                    <For each={otherVoiceRooms()}>
                      {(r) => (
                        <button type="button" role="menuitem" class={appMenuItemDefault} disabled={busy()} onClick={() => void run(() => moveMember(tg().spaceId!, tg().userId, r.id))}>
                          <i class="fa-solid fa-volume-high w-4 text-center text-muted-foreground" aria-hidden="true" />
                          <span class="truncate">{r.name}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
              <Show when={perms().moveMembers}>
                <button type="button" role="menuitem" class={appMenuItemDanger} disabled={busy()} onClick={() => void run(() => disconnectMember(tg().spaceId!, tg().userId))}>
                  <i class="fa-solid fa-phone-slash w-4 text-center" aria-hidden="true" />
                  {t('voice.menu.disconnect')}
                </button>
              </Show>
            </Show>
          </div>
        </Portal>
      )}
    </Show>
  );
};
