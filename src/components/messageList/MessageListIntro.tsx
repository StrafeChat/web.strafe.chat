import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import type { RoomParticipant } from '../../api/rooms';
import { PresenceDot } from '../PresenceDot';
import { MessageAvatar } from './MessageAvatar';
import { t } from '../../i18n';

export interface MessageListIntroProps {
  /** 1 = PM, 2 = group, 3 = space text room */
  roomType?: number;
  roomName?: string;
  /** For PM: the other participant (to show avatar + name). For notes: single participant is self. */
  pmOther?: RoomParticipant;
  /** True when this is the current user's notes room (self-PM). */
  isNotes?: boolean;
  /** Space text rooms: whether messages here are end-to-end encrypted. */
  e2eeEnabled?: boolean;
  /** Threads (room type 6): who started it and, when started from a message, what it said. */
  thread?: ThreadIntroInfo;
}

export interface ThreadIntroInfo {
  name: string;
  ownerName: string;
  private?: boolean;
  /** The starter message's text, once loaded; null when there is none. */
  starter?: string | null;
}

export const MessageListIntro: Component<MessageListIntroProps> = (props) => (
  <>
    <Show when={props.roomType === 1 && props.pmOther}>
      {(other) => {
        const username = () => other().username || t('common.unknown');
        return (
          <div class="flex flex-col items-center text-center pb-6 shrink-0">
            <div class="relative shrink-0 mb-3">
              <MessageAvatar name={username()} avatar={other().avatar} class="size-16" />
              <span class="absolute bottom-0 end-0">
                <PresenceDot userId={other().id} class="size-4" />
              </span>
            </div>
            <p class="text-base" dir="ltr">
              <span class="font-semibold text-foreground">{username()}</span>
            </p>
            <p class="text-xs text-muted-foreground/90 mt-3 max-w-[280px]">{t('intro.pmEncrypted')}</p>
          </div>
        );
      }}
    </Show>
    <Show when={props.isNotes}>
      <div class="flex flex-col items-center text-center pb-6 shrink-0">
        <div class="shrink-0 mb-3 size-16 rounded-full bg-primary/20 flex items-center justify-center">
          <i class="fa-solid fa-note-sticky text-2xl text-foreground" />
        </div>
        <p class="text-base font-semibold text-foreground">{t('intro.notesTitle')}</p>
        <p class="text-sm text-muted-foreground mt-5">{t('intro.notesBody')}</p>
      </div>
    </Show>
    <Show when={props.roomType === 2}>
      <div class="flex flex-col items-center text-center pb-6 shrink-0">
        <div class="shrink-0 mb-3 size-16 rounded-full bg-primary/20 flex items-center justify-center">
          <i class="fa-solid fa-user-group text-2xl text-foreground" />
        </div>
        <p class="text-base font-semibold text-foreground">{props.roomName || t('intro.groupTitle')}</p>
        <p class="text-sm text-muted-foreground mt-5">{t('intro.groupBody')}</p>
      </div>
    </Show>
    <Show when={props.roomType === 6 && props.thread}>
      {(th) => (
        <div class="flex flex-col items-center pb-6 text-center shrink-0">
          <div class="mb-3 flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <i class={`fa-solid ${th().private ? 'fa-lock' : 'fa-comments'} text-2xl text-foreground`} aria-hidden="true" />
          </div>
          <p class="text-2xl font-bold text-foreground">{th().name}</p>
          <p class="mt-1 text-sm text-muted-foreground">{t('threads.startedBy', { name: th().ownerName })}</p>
          <Show when={th().starter}>
            {(text) => (
              <blockquote class="mt-3 max-w-md rounded-xl border border-border/70 bg-muted/20 px-4 py-2.5 text-start text-sm text-foreground/90">
                {text()}
              </blockquote>
            )}
          </Show>
        </div>
      )}
    </Show>
    <Show when={props.roomType === 3}>
      <div class="flex flex-col items-start pb-4 shrink-0">
        <div class="shrink-0 mb-3 size-16 rounded-full bg-primary/20 flex items-center justify-center">
          <i class={`fa-solid ${props.e2eeEnabled ? 'fa-lock' : 'fa-hashtag'} text-2xl text-foreground`} aria-hidden="true" />
        </div>
        <p class="text-2xl font-bold text-foreground">{t('intro.roomWelcome', { name: props.roomName || t('intro.roomFallback') })}</p>
        <p class="mt-1 text-sm text-muted-foreground">
          {t('intro.roomStartBefore')}{' '}
          <span class="font-semibold text-foreground/90">#{props.roomName || t('intro.roomFallback')}</span>{' '}
          {t('intro.roomStartAfter')}
        </p>
        <Show when={props.e2eeEnabled}>
          <p class="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-foreground/90">
            <i class="fa-solid fa-lock text-[11px] text-primary" aria-hidden="true" />
            {t('intro.roomEncrypted')}
          </p>
        </Show>
      </div>
    </Show>
  </>
);
