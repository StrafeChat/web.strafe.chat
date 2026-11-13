import type { Component } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import type { DecryptedMessage } from '../../stores/messages';
import type { RoomParticipant } from '../../api/rooms';
import { formatSystemMessageText, getSenderDisplay } from './utils';
import { MessageAvatar } from './MessageAvatar';
import { ReplyReference } from './ReplyReference';
import { formatMessageTimestamp, formatTimeOfDay } from '../../lib/utils/datetime';

type SystemMessage = DecryptedMessage & { system_type: string; system_payload: string };

interface Tone {
  chip: string;
  badge: string;
  card: string;
}

const TONES = {
  emerald: {
    chip: 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20',
    badge: 'bg-emerald-500',
    card: 'border-emerald-500/20 bg-emerald-500/5',
  },
  rose: {
    chip: 'bg-rose-500/10 text-rose-500 ring-rose-500/20',
    badge: 'bg-rose-500',
    card: 'border-rose-500/20 bg-rose-500/5',
  },
  amber: {
    chip: 'bg-amber-500/10 text-amber-500 ring-amber-500/20',
    badge: 'bg-amber-500',
    card: 'border-amber-500/20 bg-amber-500/5',
  },
  sky: {
    chip: 'bg-sky-500/10 text-sky-500 ring-sky-500/20',
    badge: 'bg-sky-500',
    card: 'border-sky-500/20 bg-sky-500/5',
  },
  primary: {
    chip: 'bg-primary/10 text-primary ring-primary/20',
    badge: 'bg-primary',
    card: 'border-primary/20 bg-primary/5',
  },
  neutral: {
    chip: 'bg-muted text-muted-foreground ring-border',
    badge: 'bg-muted-foreground',
    card: 'border-border/60 bg-muted/20',
  },
} satisfies Record<string, Tone>;

interface EventMeta {
  icon: string;
  tone: Tone;
  avatar: boolean;
}

function payloadOf(msg: SystemMessage): Record<string, string> {
  try {
    return JSON.parse(msg.system_payload || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function metaFor(msg: SystemMessage, payload: Record<string, string>): EventMeta {
  const icon = (name: string, tone: Tone, avatar = false): EventMeta => ({ icon: name, tone, avatar });
  switch (msg.system_type) {
    case 'member_added':
      return icon('fa-user-plus', TONES.emerald, true);
    case 'member_removed':
      return icon('fa-user-minus', TONES.rose, true);
    case 'member_left':
      return icon('fa-arrow-right-from-bracket', TONES.neutral, true);
    case 'space_member_join':
      return icon('fa-arrow-right-to-bracket', TONES.emerald, true);
    case 'space_member_leave':
      return payload.how === 'kicked'
        ? icon('fa-user-slash', TONES.rose, true)
        : payload.how === 'banned'
          ? icon('fa-ban', TONES.rose, true)
          : icon('fa-arrow-right-from-bracket', TONES.neutral, true);
    case 'space_birthday':
      return icon('fa-cake-candles', TONES.amber, true);
    case 'message_pinned':
      return icon('fa-thumbtack', TONES.primary);
    case 'thread_created':
      return icon('fa-comments', TONES.sky);
    case 'thread_renamed':
    case 'room_renamed':
      return icon('fa-pen', TONES.sky);
    case 'call_started':
      return icon('fa-phone', TONES.emerald);
    case 'call_ended':
      return icon('fa-phone-slash', TONES.neutral);
    default:
      return icon('fa-circle-info', TONES.neutral);
  }
}

export interface SystemMessageRowProps {
  msg: SystemMessage;
  participants?: RoomParticipant[];
  currentUserId?: string;
  messages?: DecryptedMessage[];
  roomId?: string;
  onOpenProfile?: (userId: string, anchor: HTMLElement) => void;
  onOpenMenu?: (userId: string, e: MouseEvent) => void;
  onContextMenu?: (e: MouseEvent) => void;
}

export const SystemMessageRow: Component<SystemMessageRowProps> = (props) => {
  const payload = createMemo(() => payloadOf(props.msg));
  const meta = createMemo(() => metaFor(props.msg, payload()));
  const text = createMemo(() => formatSystemMessageText(props.msg, props.participants, props.currentUserId));
  const personId = createMemo(() => {
    const p = payload();
    return p.user_id || p.actor_id || (props.msg.sender_id !== '0' ? props.msg.sender_id : undefined);
  });
  const person = createMemo(() => {
    const id = personId();
    return id ? getSenderDisplay(id, props.participants, props.currentUserId) : null;
  });
  const threadStarterId = createMemo(() => {
    if (props.msg.system_type !== 'thread_created') return undefined;
    const threadId = payload().thread_id;
    return threadId && props.messages?.some((m) => m.id === threadId) ? threadId : undefined;
  });
  const label = createMemo(() => {
    const full = text();
    const name = person()?.name;
    if (!name || !personId() || (!props.onOpenProfile && !props.onOpenMenu)) {
      return { before: full, name: '', after: '' };
    }
    const at = full.indexOf(name);
    if (at < 0) return { before: full, name: '', after: '' };
    return { before: full.slice(0, at), name, after: full.slice(at + name.length) };
  });
  const created = createMemo(() => new Date(props.msg.created_at));

  function openProfile(anchor: HTMLElement) {
    const id = personId();
    if (id) props.onOpenProfile?.(id, anchor);
  }

  function openMenu(e: MouseEvent) {
    const id = personId();
    if (id) props.onOpenMenu?.(id, e);
  }

  return (
    <div
      data-msg-id={props.msg.id}
      class={`my-1 rounded-xl border ${meta().tone.card}`}
      onContextMenu={(e) => props.onContextMenu?.(e)}
    >
      <Show when={threadStarterId()}>
        {(threadId) => (
          <div class="px-3 pt-2">
            <ReplyReference
              replyToIds={[threadId()]}
              roomId={props.roomId}
              messages={props.messages ?? []}
              participants={props.participants}
              currentUserId={props.currentUserId}
            />
          </div>
        )}
      </Show>
      <div class="flex items-center gap-2.5 px-3 py-2">
        <Show
          when={meta().avatar}
          fallback={
            <span class={`flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${meta().tone.chip}`}>
              <i class={`fa-solid ${meta().icon} text-[11px]`} aria-hidden="true" />
            </span>
          }
        >
          <span class="relative shrink-0">
            <MessageAvatar name={person()?.name ?? '?'} avatar={person()?.avatar} class="size-8 text-xs" />
            <Show when={personId()}>
              <button
                type="button"
                class="absolute inset-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={person()?.name}
                onClick={(e) => {
                  e.stopPropagation();
                  openProfile(e.currentTarget);
                }}
                onContextMenu={openMenu}
              />
            </Show>
            <span
              class={`absolute -bottom-1 -end-1 flex size-4 items-center justify-center rounded-full ring-2 ring-background ${meta().tone.badge}`}
            >
              <i class={`fa-solid ${meta().icon} text-[7px] text-white`} aria-hidden="true" />
            </span>
          </span>
        </Show>
        <p class="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground">
          {label().before}
          <Show when={label().name}>
            {(name) => (
              <button
                type="button"
                class="rounded font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => {
                  e.stopPropagation();
                  openProfile(e.currentTarget);
                }}
                onContextMenu={openMenu}
              >
                {name()}
              </button>
            )}
          </Show>
          {label().after}
        </p>
        <time
          class="shrink-0 self-center text-[10px] tabular-nums text-muted-foreground/50"
          datetime={props.msg.created_at}
          title={formatMessageTimestamp(created())}
        >
          {formatTimeOfDay(created())}
        </time>
      </div>
    </div>
  );
};
