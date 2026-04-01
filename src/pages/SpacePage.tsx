import type { Component } from 'solid-js';
import {
  createMemo,
  createResource,
  createEffect,
  createSignal,
  onMount,
  onCleanup,
  Show,
} from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import {
  getSpaceRooms,
  listRoomPermissionOverrides,
  listSpaceRoles,
  type SpaceMember,
  type SpaceRoom,
} from '../api/spaces';
import { spaces, setSpaceRooms } from '../stores/spaces';
import {
  messages,
  setMessages,
  loadMessages,
  loadOlderMessages,
  sendMessage,
  type DecryptedMessage,
} from '../stores/messages';
import { rooms, addOrUpdateRoom } from '../stores/rooms';
import type { Room } from '../api/rooms';
import { subscribe, unsubscribe } from '../services/stargate/client';
import { sendTyping, ackRoom, ackRoomKeepalive } from '../api/rooms';
import { removeTyping } from '../stores/typing';
import { auth } from '../stores/auth';
import { stargate } from '../stores/stargate';
import { readState } from '../stores/readState';
import { setReadState } from '../stores/readState';
import { setPendingAck, clearPendingAck, getPendingAck } from '../stores/pendingAck';
import { messageIdGt } from '../stores/readState';
import { MessageList } from '../components/MessageList';
import { MessageSkeleton } from '../components/MessageSkeleton';
import { RoomMessageInput } from '../components/room/RoomMessageInput';
import { RoomMembersSidebar } from '../components/room/RoomMembersSidebar';
import { InviteSpaceModal } from '../components/InviteSpaceModal';
import { SpaceSettingsModal } from '../components/SpaceSettingsModal';
import { MobileRailsOpenButton } from '../components/layout/MobileRailsOpenButton';
import { Button } from '../components/ui/Button';
import { getMessageBodyText, getSenderDisplay } from '../components/messageList';
import { spaceMembers, loadSpaceMembers } from '../stores/spaceMembers';
import { spaceSync } from '../stores/spaceSync';
import { lastSpaceRoom } from '../stores/lastSpaceRoom';
import { createPM } from '../api/rooms';
import { dismissNewHeader, clearNewHeaderDismissed } from '../stores/newHeaderDismissed';
import { appContentBand, appHeaderBar } from '../theme/appChrome';
import {
  effectiveChannelPermissionsForMember,
  hasPerm,
  PermViewChannel,
} from '../lib/spacePermissions';

const ROOM_TYPE_TEXT = 3;
const ROOM_TYPE_VOICE = 4;

/** Convert SpaceRoom to Room so it can be added to rooms store (e.g. for sendMessage). */
function spaceRoomToRoom(r: SpaceRoom, spaceId: string): Room {
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    topic: r.topic,
    position: r.position,
    space_id: spaceId,
    parent_id: r.parent_id,
    last_message_id: r.last_message_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    recipients: [],
    participants: [],
  };
}

const SpacePage: Component = () => {
  const params = useParams<{ spaceId: string; roomId?: string }>();
  const navigate = useNavigate();
  const spaceId = () => params.spaceId;
  const roomId = () => params.roomId;
  const space = createMemo(() => spaces.spaces.find((s) => s.id === spaceId()));
  const [inviteOpen, setInviteOpen] = createSignal(false);
  const [spaceSettingsOpen, setSpaceSettingsOpen] = createSignal(false);

  const [roomsRes] = createResource(spaceId, async (id) => {
    if (!id) return [];
    const fromStore = spaces.spaceRoomsBySpaceId[id];
    if (fromStore?.length) return fromStore;
    const list = await getSpaceRooms(id);
    setSpaceRooms(id, list);
    return list;
  });

  const [spaceRolesRes] = createResource(
    () => {
      const id = spaceId();
      if (!id) return null;
      return [id, spaceSync.rolesRevision[id] ?? 0] as const;
    },
    async ([id]) => listSpaceRoles(id)
  );
  const spaceRooms = createMemo(() => {
    const id = spaceId();
    if (!id) return [];
    const fromStore = spaces.spaceRoomsBySpaceId[id];
    if (fromStore?.length) return fromStore;
    return roomsRes() ?? [];
  });
  const currentRoom = createMemo(() => {
    const id = roomId();
    if (!id) return null;
    return spaceRooms().find((r) => r.id === id) ?? null;
  });

  createEffect(() => {
    const room = currentRoom();
    const sid = spaceId();
    if (room && sid && room.type === ROOM_TYPE_TEXT) {
      addOrUpdateRoom(spaceRoomToRoom(room, sid));
      lastSpaceRoom.set(sid, room.id);
    }
  });

  const [draft, setDraft] = createSignal('');
  const [cursorPos, setCursorPos] = createSignal(0);
  const [inputRef, setInputRef] = createSignal<HTMLTextAreaElement | undefined>();
  const [replyToMessageId, setReplyToMessageId] = createSignal<string | null>(null);
  const [maxMessageIdWhenEntered, setMaxMessageIdWhenEntered] = createSignal<string | null>(null);
  const [messageListEl, setMessageListEl] = createSignal<HTMLDivElement | undefined>();
  const [nearBottom, setNearBottom] = createSignal(true);

  const roomMessages = () => (roomId() ? messages.byRoom[roomId()!] ?? [] : []);
  const isLoading = () => (roomId() ? messages.loading[roomId()!] : false);
  const isSending = () => (roomId() ? messages.sending[roomId()!] : false);
  const typingVersion = () => 0;
  const typingUserIds = () => [];
  const typingMessage = () => '';

  // Track previous space room so we can send ACK when switching channels inside a space.
  let prevRoomIdRef = '';
  // Keep this updated so we can ack the current room on unmount.
  const leaveAckRef: { roomId: string; toAck: string } = { roomId: '', toAck: '' };

  // Load messages for a space room once, then reuse cached messages like PMs do.
  createEffect(() => {
    const id = roomId();
    if (!id) return;
    const cached = messages.byRoom[id];
    if (cached === undefined) {
      loadMessages(id);
      // Reset \"NEW messages\" header visibility when entering a channel.
      clearNewHeaderDismissed(id);
      return;
    }
    if (cached.length > 0) {
      if ((messages.scrollToBottomTick[id] ?? 0) === 0) {
        setMessages('scrollToBottomTick', id, (t) => (t ?? 0) + 1);
      }
      if (messages.hasMoreOlder[id] === undefined) {
        setMessages('hasMoreOlder', id, true);
      }
    }
  });

  // Track the max message ID that existed when we entered this channel,
  // so NEW header ignores messages that arrived while we were already viewing.
  createEffect(() => {
    const id = roomId();
    // Reset when switching channels.
    setMaxMessageIdWhenEntered(null);
  });

  createEffect(() => {
    const id = roomId();
    const list = roomMessages();
    const current = maxMessageIdWhenEntered();
    if (!id || list.length === 0 || current != null) return;
    const snowflakes = list.filter((m) => /^\d+$/.test(m.id));
    if (snowflakes.length === 0) return;
    const max = snowflakes.reduce((a, b) => (messageIdGt(b.id, a.id) ? b : a));
    setMaxMessageIdWhenEntered(max.id);
  });

  // Keep leaveAckRef updated so refresh/route change can ack current space room.
  createEffect(() => {
    const id = roomId();
    if (!id) {
      leaveAckRef.roomId = '';
      leaveAckRef.toAck = '';
      return;
    }
    const r = rooms.rooms.find((x) => x.id === id);
    const lastRead = readState.byRoom[id]?.lastReadMessageId ?? r?.last_read_message_id ?? null;
    const list = messages.byRoom[id] ?? [];
    const snowflakes = list.filter((m) => /^\d+$/.test(m.id));
    let toAck = '';
    if (snowflakes.length > 0) {
      const latest = snowflakes.reduce((a, b) => (messageIdGt(b.id, a.id) ? b : a));
      if (messageIdGt(latest.id, lastRead ?? '0')) toAck = latest.id;
    } else if (r?.last_message_id && messageIdGt(r.last_message_id, lastRead ?? '0')) {
      toAck = r.last_message_id;
    }
    leaveAckRef.roomId = id;
    leaveAckRef.toAck = toAck;
  });

  const lastUnreadWhenEnteredId = createMemo(() => {
    const id = roomId();
    const list = roomMessages();
    if (!id || list.length === 0) return null;
    const uid = auth.user?.id;
    const maxWhenEntered = maxMessageIdWhenEntered();
    const r = rooms.rooms.find((x) => x.id === id);
    const lastRead = readState.byRoom[id]?.lastReadMessageId ?? r?.last_read_message_id ?? null;
    let target: string | null = null;
    for (const m of list) {
      if (m.sender_id === uid) continue;
      if (!/^\d+$/.test(m.id)) continue;
      if (maxWhenEntered != null && messageIdGt(m.id, maxWhenEntered)) continue; // arrived while viewing
      if (lastRead != null && !messageIdGt(m.id, lastRead)) continue;
      if (target == null || messageIdGt(m.id, target)) target = m.id;
    }
    return target;
  });

  function ackNow(room: string, messageId: string) {
    setReadState('byRoom', room, { lastReadMessageId: messageId, mentionCount: 0 });
    dismissNewHeader(room);
    clearPendingAck();
    ackRoom(room, messageId).catch(() => {});
  }

  // ACK only when user reaches read point: bottom or scrolled past last unread that existed on enter.
  createEffect(() => {
    const id = roomId();
    const target = lastUnreadWhenEnteredId();
    const el = messageListEl();
    if (!id || !target) return;
    const r = rooms.rooms.find((x) => x.id === id);
    const already = readState.byRoom[id]?.lastReadMessageId ?? r?.last_read_message_id ?? null;
    if (already != null && !messageIdGt(target, already)) return;

    if (nearBottom()) {
      ackNow(id, target);
      return;
    }

    if (!el) return;
    const targetEl = el.querySelector(`[data-msg-id="${target}"]`) as HTMLElement | null;
    if (!targetEl) return;
    const listRect = el.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    // Consider read once the unread marker message has reached/passed bottom of viewport.
    if (targetRect.bottom <= listRect.bottom - 4) {
      ackNow(id, target);
    }
  });

  // When switching between space text channels, ACK the previous one if needed.
  createEffect(() => {
    const id = roomId();
    if (!id) {
      prevRoomIdRef = '';
      return;
    }
    const prevId = prevRoomIdRef;
    prevRoomIdRef = id;
    if (!prevId || prevId === id) return;
    const r = rooms.rooms.find((x) => x.id === prevId);
    const lastRead =
      readState.byRoom[prevId]?.lastReadMessageId ?? r?.last_read_message_id ?? null;
    const list = messages.byRoom[prevId] ?? [];
    const snowflakes = list.filter((m) => /^\d+$/.test(m.id));
    let toAck = '';
    if (snowflakes.length > 0) {
      const latest = snowflakes.reduce((a, b) =>
        messageIdGt(b.id, a.id) ? b : a
      );
      if (messageIdGt(latest.id, lastRead ?? '0')) toAck = latest.id;
    } else if (r?.last_message_id && messageIdGt(r.last_message_id, lastRead ?? '0')) {
      toAck = r.last_message_id;
    }
    if (toAck) {
      setReadState('byRoom', prevId, { lastReadMessageId: toAck, mentionCount: 0 });
      dismissNewHeader(prevId);
      ackRoom(prevId, toAck).catch(() => {});
    }
  });

  createEffect(() => {
    const id = roomId();
    if (stargate.ready && id) {
      subscribe(id, undefined);
      return () => unsubscribe(id, undefined);
    }
  });

  createEffect(() => {
    const id = roomId();
    const r = rooms.rooms.find((x) => x.id === id);
    if (!id) {
      clearPendingAck();
      return;
    }
    const list = messages.byRoom[id] ?? [];
    if (list.length === 0) {
      clearPendingAck();
      return;
    }
    const snowflakes = list.filter((m) => /^\d+$/.test(m.id));
    if (snowflakes.length === 0) {
      clearPendingAck();
      return;
    }
    const latest = snowflakes.reduce((a, b) => (messageIdGt(b.id, a.id) ? b : a));
    const lastRead = readState.byRoom[id]?.lastReadMessageId ?? r?.last_read_message_id ?? null;
    if (messageIdGt(latest.id, lastRead ?? '0')) {
      setPendingAck(id, latest.id);
    } else {
      clearPendingAck();
    }
  });

  onCleanup(() => {
    clearPendingAck();
    if (leaveAckRef.roomId) clearNewHeaderDismissed(leaveAckRef.roomId);
    if (leaveAckRef.roomId && leaveAckRef.toAck) {
      setReadState('byRoom', leaveAckRef.roomId, {
        lastReadMessageId: leaveAckRef.toAck,
        mentionCount: 0,
      });
      dismissNewHeader(leaveAckRef.roomId);
      ackRoom(leaveAckRef.roomId, leaveAckRef.toAck).catch(() => {});
    }
  });

  onMount(() => {
    const onBeforeUnload = () => {
      const p = getPendingAck();
      if (p) ackRoomKeepalive(p.roomId, p.messageId);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  });

  // Load space members so we can show a members list for the space (with presence).
  createEffect(() => {
    const sid = spaceId();
    if (sid) {
      loadSpaceMembers(sid).catch(() => {});
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    const id = roomId();
    const text = draft().trim();
    if (!id || !text || isSending()) return;
    if (auth.user?.id) removeTyping(id, auth.user.id);
    sendMessage(id, text, replyToMessageId() ?? undefined)
      .then(() => {
        setDraft('');
        setReplyToMessageId(null);
        inputRef()?.focus();
        dismissNewHeader(id);
      })
      .catch((err) => console.error('Send failed:', err));
  }

  function handleReplyToMessage(msg: DecryptedMessage) {
    setReplyToMessageId(msg.id);
    queueMicrotask(() => inputRef()?.focus());
  }

  let lastTypingSent = 0;
  const TYPING_DEBOUNCE_MS = 5000;
  function onInput(e: InputEvent) {
    const el = e.target as HTMLTextAreaElement;
    setDraft(el.value);
    setCursorPos(el.selectionStart);
    const id = roomId();
    if (id) {
      const now = Date.now();
      if (now - lastTypingSent >= TYPING_DEBOUNCE_MS) {
        lastTypingSent = now;
        sendTyping(id).catch(() => {});
      }
    }
  }

  const isTextChannel = () => currentRoom()?.type === ROOM_TYPE_TEXT;
  const isVoiceChannel = () => currentRoom()?.type === ROOM_TYPE_VOICE;

  const [roomOverridesRes] = createResource(
    () => {
      const sid = spaceId();
      const rid = roomId();
      if (!sid || !rid || currentRoom()?.type !== ROOM_TYPE_TEXT) return null;
      const k = `${sid}:${rid}`;
      return [sid, rid, spaceSync.roomOverridesRevision[k] ?? 0] as const;
    },
    async ([sid, rid]) => listRoomPermissionOverrides(sid, rid)
  );

  const visibleMembers = createMemo(() => {
    const sid = spaceId();
    const members = sid ? spaceMembers.bySpaceId[sid] ?? [] : [];
    const roles = spaceRolesRes();
    const ovs = roomOverridesRes();
    const sp = space();
    const rid = roomId();
    if (!rid || !sp || currentRoom()?.type !== ROOM_TYPE_TEXT) {
      return members;
    }
    if (roles === undefined || ovs === undefined) {
      return members;
    }
    return members.filter((m) => {
      const mask = effectiveChannelPermissionsForMember({
        memberUserId: m.id,
        ownerId: sp.owner_id,
        everyoneRoleId: sp.everyone_role_id,
        memberRoleIds: (m as SpaceMember).roles,
        roles,
        overrides: ovs,
      });
      if (mask === null) return true;
      return hasPerm(mask, PermViewChannel);
    });
  });

  return (
    <div class="flex-1 flex flex-col min-h-0">
      {/* Header: space icon + space name when no room, or # channel name when in a room */}
      <div class={`flex h-12 shrink-0 items-center justify-between gap-3 px-4 ${appHeaderBar}`}>
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <MobileRailsOpenButton />
          <h1 class="min-w-0 truncate text-base font-semibold text-foreground">
            <Show when={currentRoom()} fallback={space()?.name || `Space ${spaceId()}`}>
              <span class="font-normal text-muted-foreground"># </span>
              {currentRoom()!.name || 'general'}
            </Show>
          </h1>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Show when={space()}>
            <Button type="button" size="sm" variant="outline" onClick={() => setSpaceSettingsOpen(true)}>
              Space settings
            </Button>
          </Show>
          <Show when={space() && auth.user?.id === space()!.owner_id}>
            <Button type="button" size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
              Invite people
            </Button>
          </Show>
        </div>
      </div>

      {/* Content: space overview when no room, text channel when room is text, voice placeholder when voice */}
      <Show when={!roomId()}>
        <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p class="text-muted-foreground">Select a channel or create one.</p>
        </div>
      </Show>

      <Show when={roomId() && isVoiceChannel()}>
        <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p class="text-muted-foreground">Voice channels are not yet supported.</p>
        </div>
      </Show>

      <Show when={roomId() && isTextChannel()}>
        <div class="flex-1 flex min-h-0 overflow-hidden">
          <Show when={!currentRoom()}>
            <div class="flex-1 flex items-center justify-center p-8 text-muted-foreground">
              Loading channel...
            </div>
          </Show>
          <Show when={currentRoom()}>
            <div class="flex-1 flex flex-col min-h-0 min-w-0">
              <Show when={!isLoading()} fallback={<MessageSkeleton />}>
                <MessageList
                  messages={roomMessages()}
                  roomId={roomId()!}
                  roomType={ROOM_TYPE_TEXT}
                  roomName={currentRoom()!.name}
                  participants={visibleMembers()}
                  loadingOlder={messages.loadingOlder[roomId()!]}
                  hasMoreOlder={messages.hasMoreOlder[roomId()!]}
                  onLoadOlder={(getScroll) => loadOlderMessages(roomId()!, getScroll)}
                  lastReadMessageId={readState.byRoom[roomId()!]?.lastReadMessageId ?? null}
                  maxMessageIdWhenEntered={maxMessageIdWhenEntered()}
                  onReply={handleReplyToMessage}
                  onNearBottomChange={setNearBottom}
                  onScrollContainer={setMessageListEl}
                />
              </Show>
              <div>
                <Show when={replyToMessageId()}>
                  {(() => {
                    const targetId = replyToMessageId();
                    const list = roomMessages();
                    const target = list.find((m) => m.id === targetId) as DecryptedMessage | undefined;
                    if (!target) {
                      return (
                        <div class={`flex items-center justify-between gap-2 px-3 pb-1 pt-2 text-xs text-muted-foreground ${appContentBand}`}>
                          <span class="truncate">Replying to message</span>
                          <button
                            type="button"
                            class="text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => setReplyToMessageId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      );
                    }
                    const sender = getSenderDisplay(
                      target.sender_id,
                      spaceMembers.bySpaceId[spaceId()!] ?? [],
                      auth.user?.id
                    );
                    const text = getMessageBodyText(target);
                    const preview = text.length > 120 ? `${text.slice(0, 117)}…` : text;
                    return (
                      <div class={`flex items-start justify-between gap-2 px-3 pb-1 pt-2 text-xs ${appContentBand}`}>
                        <div class="min-w-0">
                          <p class="text-[11px] text-muted-foreground mb-0.5">
                            Replying to <span class="text-foreground font-medium">{sender.name}</span>
                          </p>
                          <p class="text-[12px] text-muted-foreground truncate">{preview}</p>
                        </div>
                        <button
                          type="button"
                          class="mt-0.5 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                          onClick={() => setReplyToMessageId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    );
                  })()}
                </Show>
                <RoomMessageInput
                  draft={draft()}
                  onInput={onInput}
                  onSubmit={handleSubmit}
                  placeholder={`Message #${currentRoom()!.name || 'general'}`}
                  disabled={isSending()}
                  inputRef={setInputRef}
                  typingMessage={typingMessage()}
                  showTyping={typingUserIds().length > 0}
                  participants={visibleMembers()}
                  currentUserId={auth.user?.id}
                  cursorPos={cursorPos()}
                  onCursorChange={setCursorPos}
                />
              </div>
            </div>
            <RoomMembersSidebar
              participants={visibleMembers()}
              currentUserId={auth.user?.id}
              onMessageUser={(userId) => {
                createPM(userId)
                  .then((r) => navigate(`/rooms/${r.id}`))
                  .catch((err) => console.error('Failed to open DM:', err));
              }}
              creatorId={space()?.owner_id}
              spaceRoles={spaceRolesRes()}
              showMembersHeader={false}
              listAriaLabel="Space members"
            />
          </Show>
        </div>
      </Show>
      <InviteSpaceModal
        open={inviteOpen()}
        spaceId={spaceId()}
        onClose={() => setInviteOpen(false)}
      />
      <SpaceSettingsModal
        open={spaceSettingsOpen()}
        onClose={() => setSpaceSettingsOpen(false)}
        space={space()}
        spaceId={spaceId()}
        roomId={roomId() && isTextChannel() ? roomId()! : null}
        members={spaceMembers.bySpaceId[spaceId()!] ?? []}
        canManage={!!space() && auth.user?.id === space()!.owner_id}
        ownerId={space()?.owner_id ?? ''}
        onMembersUpdated={() => {
          const sid = spaceId();
          if (sid) loadSpaceMembers(sid).catch(() => {});
        }}
      />
    </div>
  );
};

export default SpacePage;
