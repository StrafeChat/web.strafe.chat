import type { Component } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';
import type { VoiceState } from '../../api/voice';
import type { RoomParticipant } from '../../api/rooms';
import { auth } from '../../stores/auth';
import { voice, voiceStatesForRoom } from '../../stores/voice';
import { spaceMembers } from '../../stores/spaceMembers';
import { spaceRoles } from '../../stores/spaces';
import { openUserProfileFromParticipant } from '../../stores/userProfilePopover';
import { voiceParticipantName } from '../../lib/voice/perms';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { openVoiceUserMenu } from './VoiceUserMenu';
import { t } from '../../i18n';

export interface VoiceChannelUsersProps {
  roomId: string;
  spaceId: string;
}

/** The people in a voice room, listed under its row in the space sidebar. */
export const VoiceChannelUsers: Component<VoiceChannelUsersProps> = (props) => {
  const states = createMemo(() =>
    [...voiceStatesForRoom(props.roomId)].sort((a, b) => a.joined_at.localeCompare(b.joined_at))
  );
  const member = (st: VoiceState) => spaceMembers.bySpaceId[props.spaceId]?.find((m) => m.id === st.user_id);
  const avatar = (st: VoiceState) => member(st)?.avatar ?? st.user?.avatar;
  const name = (st: VoiceState) => voiceParticipantName(st.user_id, st, props.spaceId);

  function openProfile(e: MouseEvent, st: VoiceState) {
    const m = member(st);
    const participant: RoomParticipant = m ?? {
      id: st.user_id,
      username: st.user?.username ?? '',
      display_name: st.user?.display_name ?? '',
      discriminator: st.user?.discriminator,
      avatar: st.user?.avatar,
    };
    openUserProfileFromParticipant({
      participant,
      anchor: e.currentTarget as HTMLElement,
      currentUserId: auth.user?.id,
      spaceRoles: spaceRoles(props.spaceId),
    });
  }

  return (
    <Show when={states().length > 0}>
      <div class="mb-1 ms-6 space-y-px" data-voice-users={props.roomId}>
        <For each={states()}>
          {(st) => {
            const speaking = () => !!voice.speaking[st.user_id];
            return (
              <button
                type="button"
                class={`flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-start text-[13px] transition-colors hover:bg-accent/50 ${
                  speaking() ? 'text-foreground' : 'text-muted-foreground'
                }`}
                onClick={(e) => openProfile(e, st)}
                onContextMenu={(e) => openVoiceUserMenu(e, { userId: st.user_id, roomId: props.roomId, spaceId: props.spaceId })}
                title={name(st)}
              >
                <span class={`shrink-0 rounded-full ring-2 transition-[ring-color] ${speaking() ? 'ring-emerald-400' : 'ring-transparent'}`}>
                  <MessageAvatar name={name(st)} avatar={avatar(st)} class="size-6 text-[11px]" />
                </span>
                <span class="min-w-0 flex-1 truncate">{name(st)}</span>
                <span class="flex shrink-0 items-center gap-1 text-[10px]">
                  <Show when={st.self_stream}>
                    <span class="rounded bg-destructive/90 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-white" title={t('voice.status.streaming')}>
                      {t('voice.liveBadge')}
                    </span>
                  </Show>
                  <Show when={st.self_video}>
                    <i class="fa-solid fa-video" aria-hidden="true" title={t('voice.status.video')} />
                  </Show>
                  <Show when={st.self_mute || st.mute}>
                    <i class={`fa-solid fa-microphone-slash ${st.mute ? 'text-red-400' : ''}`} aria-hidden="true" title={st.mute ? t('voice.status.serverMuted') : t('voice.status.muted')} />
                  </Show>
                  <Show when={st.self_deaf || st.deaf}>
                    <i class={`fa-solid fa-volume-xmark ${st.deaf ? 'text-red-400' : ''}`} aria-hidden="true" title={st.deaf ? t('voice.status.serverDeafened') : t('voice.status.deafened')} />
                  </Show>
                </span>
              </button>
            );
          }}
        </For>
      </div>
    </Show>
  );
};
