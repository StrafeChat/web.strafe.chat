import type { Component } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useNavigate } from '@solidjs/router';
import { auth } from '../../stores/auth';
import {
  leaveVoiceRoom,
  noiseSuppressionEnabled,
  setScreenShareEnabled,
  toggleCamera,
  toggleNoiseSuppression,
  voice,
  voiceStatesForRoom,
} from '../../stores/voice';
import { openScreenShareDialog } from './ScreenShareDialog';
import { openVoiceUserMenu } from './VoiceUserMenu';
import { rooms, roomDisplayName } from '../../stores/rooms';
import { spaces } from '../../stores/spaces';
import { spaceMembers } from '../../stores/spaceMembers';
import { voicePermsFor, voiceParticipantName } from '../../lib/voice/perms';
import { appUserDock } from '../../theme/appChrome';
import { IconButton } from '../ui/IconButton';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { toggleVoiceStats } from './VoiceStatsPopover';
import { t } from '../../i18n';

export interface VoiceDockProps {
  /** `rail`: sits above the user area in a sidebar. `mobile`: floating bar over the page. */
  variant: 'rail' | 'mobile';
}

/** Avatars past this collapse into a "+N" chip; the rail is only 240px wide. */
const MAX_AVATARS = 7;

/** One action on the bottom row: a wide pill, because two icon squares in 240px read as debris. */
const actionPill =
  'flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
const actionIdle = 'bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground';
const actionOn = 'bg-primary/20 text-foreground ring-1 ring-inset ring-primary/30 hover:bg-primary/25';

/**
 * Discord's "Voice Connected" panel, in its shape: the call's identity and the two
 * controls you reach for in a hurry (noise suppression, hang up) share the top line, the
 * people in the call sit under it as avatars, and the rest of the controls get a row of
 * their own. Mute and deafen stay next to the user area below, as they do on Discord.
 */
export const VoiceDock: Component<VoiceDockProps> = (props) => {
  const navigate = useNavigate();
  const s = () => voice.session;
  const active = () => s().status !== 'idle' && !!s().roomId;
  const visible = () => active() && (props.variant === 'rail' || !voice.stageVisible);

  const roomName = createMemo(() => {
    const rid = s().roomId;
    if (!rid) return '';
    const sid = s().spaceId;
    if (sid) return spaces.spaceRoomsBySpaceId[sid]?.find((r) => r.id === rid)?.name ?? '';
    const r = rooms.rooms.find((x) => x.id === rid);
    return r && auth.user?.id ? roomDisplayName(r, auth.user.id) : '';
  });
  const spaceName = () => (s().spaceId ? spaces.spaces.find((x) => x.id === s().spaceId)?.name ?? '' : t('nav.privateMessages'));
  const href = () => (s().spaceId ? `/spaces/${s().spaceId}/rooms/${s().roomId}` : `/rooms/${s().roomId}`);
  const perms = createMemo(() => voicePermsFor(auth.user?.id, s().spaceId ?? undefined, s().roomId ?? undefined));

  // Everyone *else* in the call. Your own avatar is left out: you are already the user
  // area directly below this, and in a one-to-one call showing yourself back is noise.
  const participants = createMemo(() => {
    const me = auth.user?.id;
    return [...voiceStatesForRoom(s().roomId ?? '')]
      .filter((st) => st.user_id !== me)
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  });
  const shown = createMemo(() => participants().slice(0, MAX_AVATARS));
  const overflow = createMemo(() => Math.max(0, participants().length - MAX_AVATARS));
  const nameOf = (st: { user_id: string; user?: { display_name?: string; username?: string } }) =>
    voiceParticipantName(st.user_id, st, s().spaceId ?? undefined);
  const avatarOf = (st: { user_id: string; user?: { avatar?: string } }) => {
    const sid = s().spaceId;
    if (sid) {
      const m = spaceMembers.bySpaceId[sid]?.find((x) => x.id === st.user_id);
      if (m?.avatar) return m.avatar;
    }
    return st.user?.avatar;
  };

  const statusText = () => {
    switch (s().status) {
      case 'connecting':
        return t('voice.connecting');
      case 'reconnecting':
        return t('voice.reconnecting');
      default:
        return t('voice.connected');
    }
  };
  const statusTone = () => (s().status === 'connected' ? 'text-emerald-500' : 'text-amber-500');
  const qualityIcon = () => {
    switch (s().quality) {
      case 'poor':
        return 'fa-triangle-exclamation';
      case 'lost':
        return 'fa-xmark';
      default:
        return 'fa-signal';
    }
  };

  /**
   * The panel itself. Rendered in place on the rail; on mobile it is portaled to the
   * body, because AppShell's swipe track is `transform`ed and a `position: fixed` child
   * of a transformed ancestor is laid out against *that* box rather than the viewport -
   * which stretched this to the full 200vw track instead of the phone's width.
   */
  const panel = () => (
    <div
      class={`${
        props.variant === 'mobile'
          ? 'fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 rounded-2xl border border-border shadow-lg shadow-black/30 md:hidden'
          : ''
      } ${appUserDock} space-y-1.5 px-2 py-2`}
      data-voice-dock
    >
        {/* Where you are, and the two controls worth reaching for without looking. */}
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="flex min-w-0 flex-1 flex-col items-start rounded-md px-1.5 py-1 text-start transition-colors hover:bg-accent/50"
            aria-label={t('voice.stats.title')}
            title={t('voice.stats.title')}
            onClick={(e) => toggleVoiceStats(e.currentTarget)}
          >
            <span class={`flex w-full min-w-0 items-center gap-1.5 text-sm font-semibold leading-tight ${statusTone()}`}>
              <i class={`fa-solid ${qualityIcon()} shrink-0 text-[11px]`} aria-hidden="true" />
              <span class="truncate">{statusText()}</span>
            </span>
          </button>
          <IconButton
            size="sm"
            icon="fa-solid fa-wind"
            label={noiseSuppressionEnabled() ? t('voice.noiseSuppressionOff') : t('voice.noiseSuppressionOn')}
            active={noiseSuppressionEnabled()}
            onClick={toggleNoiseSuppression}
          />
          <IconButton
            size="sm"
            icon="fa-solid fa-phone-slash"
            label={t('voice.leave')}
            tone="danger"
            onClick={() => void leaveVoiceRoom()}
          />
        </div>

        {/* The room, on its own line so a long name has the full width to be read in. */}
        <button
          type="button"
          class="block w-full truncate rounded-md px-1.5 text-start text-xs leading-tight text-muted-foreground transition-colors hover:text-foreground"
          title={`${roomName()} / ${spaceName()}`}
          onClick={() => navigate(href())}
        >
          {roomName()} <span class="text-muted-foreground/60">/ {spaceName()}</span>
        </button>

        {/* Who is in it. Speaking rings come from the same active-speaker data as the tiles. */}
        <Show when={participants().length > 0}>
          <div
            class="flex flex-wrap items-center gap-1 px-1.5 pt-0.5"
            aria-label={t('voice.participants', { count: participants().length })}
          >
            <For each={shown()}>
              {(st) => (
                <span
                  class={`shrink-0 rounded-full ring-2 transition-[box-shadow,ring-color] ${
                    voice.speaking[st.user_id] ? 'ring-emerald-400' : 'ring-transparent'
                  }`}
                  title={nameOf(st)}
                  onContextMenu={(e) =>
                    openVoiceUserMenu(e, {
                      userId: st.user_id,
                      roomId: s().roomId ?? '',
                      spaceId: s().spaceId ?? undefined,
                    })
                  }
                >
                  <MessageAvatar name={nameOf(st)} avatar={avatarOf(st)} class="size-6 text-[10px]" />
                </span>
              )}
            </For>
            <Show when={overflow() > 0}>
              <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/60 text-[10px] font-semibold text-muted-foreground">
                +{overflow()}
              </span>
            </Show>
          </div>
        </Show>

        {/* Everything else, as wide buttons rather than a row of small squares. */}
        <div class="flex items-center gap-1">
          <button
            type="button"
            class={`${actionPill} ${s().camera ? actionOn : actionIdle}`}
            aria-pressed={s().camera}
            disabled={!perms().video}
            title={s().camera ? t('voice.cameraOff') : t('voice.cameraOn')}
            onClick={toggleCamera}
          >
            <i class={`fa-solid ${s().camera ? 'fa-video' : 'fa-video-slash'} text-[11px]`} aria-hidden="true" />
            <span class="truncate">{t('voice.dockCamera')}</span>
          </button>
          <button
            type="button"
            class={`${actionPill} ${s().screen ? actionOn : actionIdle}`}
            aria-pressed={s().screen}
            disabled={!perms().video || typeof navigator.mediaDevices?.getDisplayMedia !== 'function'}
            title={s().screen ? t('voice.stopSharing') : t('voice.shareScreen')}
            onClick={() => (s().screen ? void setScreenShareEnabled(false) : openScreenShareDialog())}
          >
            <i class="fa-solid fa-display text-[11px]" aria-hidden="true" />
            <span class="truncate">{t('voice.dockScreen')}</span>
          </button>
        </div>
    </div>
  );

  return (
    <Show when={visible()}>
      <Show when={props.variant === 'mobile'} fallback={panel()}>
        <Portal mount={document.body}>{panel()}</Portal>
      </Show>
    </Show>
  );
};
