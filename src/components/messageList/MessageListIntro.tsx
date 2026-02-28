import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import type { RoomParticipant } from '../../api/rooms';
import { PresenceDot } from '../PresenceDot';
import { MessageAvatar } from './MessageAvatar';

export interface MessageListIntroProps {
  /** 1 = PM, 2 = group */
  roomType?: number;
  roomName?: string;
  /** For PM: the other participant (to show avatar + name). For notes: single participant is self. */
  pmOther?: RoomParticipant;
  /** True when this is the current user's notes room (self-PM). */
  isNotes?: boolean;
}

export const MessageListIntro: Component<MessageListIntroProps> = (props) => (
  <>
    <Show when={props.roomType === 1 && props.pmOther}>
      {(other) => {
        const username = () => other().username || 'Unknown';
        const discrim = () => {
          const d = other().discriminator;
          return d != null ? String(d).padStart(4, '0') : null;
        };
        return (
          <div class="flex flex-col items-center text-center pb-6 shrink-0">
            <div class="relative shrink-0 mb-3">
              <MessageAvatar name={username()} avatar={other().avatar} class="size-16" />
              <span class="absolute bottom-0 right-0">
                <PresenceDot userId={other().id} class="size-4" />
              </span>
            </div>
            <p class="text-base">
              <span class="font-semibold text-foreground">{username()}</span>
              <Show when={discrim()}>
                {(d) => <span class="text-muted-foreground font-normal">#{d()}</span>}
              </Show>
            </p>
            <p class="text-xs text-muted-foreground/90 mt-3 max-w-[280px]">
              Messages are end-to-end encrypted. No one outside of this conversation, not even Strafe, can read your messages.
            </p>
          </div>
        );
      }}
    </Show>
    <Show when={props.isNotes}>
      <div class="flex flex-col items-center text-center pb-6 shrink-0">
        <div class="shrink-0 mb-3 size-16 rounded-full bg-primary/20 flex items-center justify-center">
          <i class="fa-solid fa-note-sticky text-2xl text-foreground" />
        </div>
        <p class="text-base font-semibold text-foreground">Private Notes</p>
        <p class="text-sm text-muted-foreground mt-5">
          Your private notes. Only you can see these.
        </p>
      </div>
    </Show>
    <Show when={props.roomType === 2}>
      <div class="flex flex-col items-center text-center pb-6 shrink-0">
        <div class="shrink-0 mb-3 size-16 rounded-full bg-primary/20 flex items-center justify-center">
          <i class="fa-solid fa-user-group text-2xl text-foreground" />
        </div>
        <p class="text-base font-semibold text-foreground">
          {props.roomName || 'Group conversation'}
        </p>
        <p class="text-sm text-muted-foreground mt-5">
          This is the beginning of the group conversation.
        </p>
      </div>
    </Show>
  </>
);
