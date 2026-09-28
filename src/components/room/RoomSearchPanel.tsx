import type { Component } from 'solid-js';
import { For, Show, createEffect, createMemo, createSignal, on } from 'solid-js';
import type { RoomParticipant } from '../../api/rooms';
import type { SpaceRole } from '../../api/spaces';
import { appActivityRail, appSectionLabel } from '../../theme/appChrome';
import { IconButton } from '../ui/IconButton';
import { getMessageBodyText, getSenderDisplay } from '../messageList';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { MessageBody } from '../messageList/MessageBody';
import { MessageAttachments } from '../messageList/MessageAttachments';
import {
  isEmptyQuery,
  parseSearchQuery,
  searchRoomMessages,
  searchSpaceMessages,
  type SearchChannel,
  type SearchMatch,
} from '../../lib/messageSearch';
import { auth } from '../../stores/auth';
import { openUserProfilePopover } from '../../stores/userProfilePopover';
import { popoverSubjectFromSender } from '../../lib/userProfilePopoverHelpers';
import { formatMessageTimestamp } from '../../lib/utils/datetime';
import { t } from '../../i18n';

export interface RoomSearchPanelProps {
  /** Set for a space: the search spans every channel of it the user can read. */
  spaceId?: string;
  /** The conversation currently on screen - the only one searched outside a space, and
   * the one whose local history is searched when it's E2EE. */
  roomId: string;
  /** Raw query text as submitted from the header search box. */
  query: string;
  participants?: RoomParticipant[];
  /** Space channels, for `in:` and for labelling which channel a hit came from. */
  channels?: SearchChannel[];
  spaceRoles?: SpaceRole[];
  /** True when roomId is end-to-end encrypted, so the server cannot search it. */
  roomE2EE?: boolean;
  onClose: () => void;
  onSelectMessage: (messageId: string, roomId: string) => void;
}

/** Discord-style results column: the query is built in the header search box, this only
 * renders what came back - as real messages, the same way the chat does. */
export const RoomSearchPanel: Component<RoomSearchPanelProps> = (props) => {
  const [loading, setLoading] = createSignal(false);
  const [results, setResults] = createSignal<SearchMatch[]>([]);
  const [hasMore, setHasMore] = createSignal(false);
  const [localOnly, setLocalOnly] = createSignal(false);
  const [encryptedRooms, setEncryptedRooms] = createSignal(0);
  const [searched, setSearched] = createSignal(false);
  const [failed, setFailed] = createSignal(false);
  let nextBefore: string | undefined;
  let requestId = 0;

  const currentUserId = () => auth.user?.id;
  const channelName = (roomId: string) =>
    props.channels?.find((c) => c.id === roomId)?.name || t('space.defaultRoom');

  async function runSearch(before?: string) {
    const text = props.query.trim();
    const query = parseSearchQuery(text, { people: props.participants ?? [], channels: props.channels });
    if (!text || isEmptyQuery(query)) {
      requestId++;
      setResults([]);
      setHasMore(false);
      setSearched(false);
      setFailed(false);
      return;
    }
    const myRequest = ++requestId;
    setLoading(true);
    setFailed(false);
    try {
      const outcome = props.spaceId
        ? await searchSpaceMessages(props.spaceId, query, before, props.roomE2EE ? props.roomId : undefined)
        : await searchRoomMessages(props.roomId, query, before);
      if (myRequest !== requestId) return; // a newer search superseded this one
      setResults((prev) => (before ? [...prev, ...outcome.matches] : outcome.matches));
      setHasMore(outcome.hasMore);
      setLocalOnly(outcome.localOnly);
      setEncryptedRooms(outcome.encryptedRooms ?? 0);
      nextBefore = outcome.nextBefore;
      setSearched(true);
    } catch (err) {
      console.error('Search failed:', err);
      if (myRequest === requestId) {
        setFailed(true);
        setSearched(true);
        if (!before) setResults([]);
      }
    } finally {
      if (myRequest === requestId) setLoading(false);
    }
  }

  // The header box submits (Enter); this panel just reacts to whatever query it was handed.
  createEffect(on(() => [props.query, props.roomId, props.spaceId] as const, () => void runSearch()));

  const grouped = createMemo(() => {
    const list = results();
    if (!props.spaceId) return [{ roomId: props.roomId, matches: list, showHeader: false }];
    const out: { roomId: string; matches: SearchMatch[]; showHeader: boolean }[] = [];
    for (const m of list) {
      const last = out[out.length - 1];
      if (last && last.roomId === m.roomId) last.matches.push(m);
      else out.push({ roomId: m.roomId, matches: [m], showHeader: true });
    }
    return out;
  });

  function openMentionProfile(userId: string, anchor: HTMLElement) {
    const s = getSenderDisplay(userId, props.participants, currentUserId());
    openUserProfilePopover({
      anchor,
      subject: popoverSubjectFromSender(s, { participant: props.participants?.find((x) => x.id === userId), spaceRoles: props.spaceRoles }),
      currentUserId: currentUserId(),
    });
  }

  const countLabel = () =>
    hasMore()
      ? t('room.search.resultsMore', { count: results().length })
      : t('room.search.results', { count: results().length });

  return (
    <aside
      class={`hidden w-[22rem] shrink-0 flex-col overflow-hidden lg:w-[26rem] md:flex md:flex-col ${appActivityRail}`}
      aria-label={t('room.searchMessages')}
    >
      <div class="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <h2 class="truncate text-sm font-semibold text-foreground">
          <Show when={searched()} fallback={t('common.search')}>
            {countLabel()}
          </Show>
        </h2>
        <IconButton size="sm" icon="fa-solid fa-xmark" label={t('room.search.close')} onClick={props.onClose} />
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <Show
          when={searched()}
          fallback={
            <p class="px-1 text-xs leading-relaxed text-muted-foreground">
              {t('room.search.hint')}
              <span class="mt-2 block text-[11px] text-muted-foreground/80">{t('room.search.operatorHint')}</span>
            </p>
          }
        >
          <Show when={localOnly()}>
            <p class="mb-2 flex items-start gap-1.5 rounded-lg bg-muted/30 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
              <i class="fa-solid fa-lock mt-0.5 text-[9px]" aria-hidden="true" />
              {t('room.search.e2eeNote')}
            </p>
          </Show>
          <Show when={encryptedRooms() > 0}>
            <p class="mb-2 flex items-start gap-1.5 rounded-lg bg-muted/30 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
              <i class="fa-solid fa-lock mt-0.5 text-[9px]" aria-hidden="true" />
              {t('room.search.encryptedRooms', { count: encryptedRooms() })}
            </p>
          </Show>
          <Show when={failed()}>
            <p class="mb-2 text-xs text-destructive">{t('room.search.failed')}</p>
          </Show>
          <Show when={results().length === 0 && !loading() && !failed()}>
            <p class="px-1 text-xs text-muted-foreground">{t('room.search.none')}</p>
          </Show>

          <For each={grouped()}>
            {(group) => (
              <section class="mb-3">
                <Show when={group.showHeader}>
                  <h3 class={`${appSectionLabel} mb-1.5 flex items-center gap-1.5 px-1`}>
                    <i class="fa-solid fa-hashtag text-[10px]" aria-hidden="true" />
                    <span class="truncate normal-case tracking-normal text-[12px] text-foreground">
                      {channelName(group.roomId)}
                    </span>
                  </h3>
                </Show>
                <div class="space-y-2">
                  <For each={group.matches}>
                    {(hit) => {
                      const msg = hit.message;
                      const sender = () => getSenderDisplay(msg.sender_id, props.participants, currentUserId());
                      return (
                        <div
                          role="button"
                          tabIndex={0}
                          class="group/hit relative flex w-full gap-2.5 rounded-xl border border-border/80 bg-card/50 px-3 py-2.5 text-start transition-colors hover:bg-card/80"
                          onClick={() => props.onSelectMessage(msg.id, hit.roomId)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              props.onSelectMessage(msg.id, hit.roomId);
                            }
                          }}
                        >
                          <MessageAvatar
                            name={sender().name}
                            avatar={sender().avatar}
                            class="size-8 shrink-0 text-[11px]"
                          />
                          <div class="min-w-0 flex-1">
                            <div class="mb-0.5 flex items-baseline justify-between gap-2 pe-10">
                              <span class="truncate text-[13px] font-semibold text-foreground">{sender().name}</span>
                              <span class="shrink-0 text-[11px] text-muted-foreground">
                                {formatMessageTimestamp(new Date(msg.created_at))}
                              </span>
                            </div>
                            <div class="text-[13px] leading-relaxed text-foreground/90">
                              <MessageBody
                                text={getMessageBodyText(msg)}
                                participants={props.participants}
                                spaceRoles={props.spaceRoles}
                                onMentionClick={openMentionProfile}
                              />
                            </div>
                            <Show when={msg.attachments?.length}>
                              <MessageAttachments attachments={msg.attachments!} />
                            </Show>
                          </div>
                          <span class="pointer-events-none absolute end-2 top-2 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary opacity-0 transition-opacity group-hover/hit:opacity-100">
                            {t('room.search.jump')}
                          </span>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </section>
            )}
          </For>

          <Show when={hasMore()}>
            <button
              type="button"
              class="mt-1 w-full rounded-lg border border-border/70 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/50"
              disabled={loading()}
              onClick={() => void runSearch(nextBefore)}
            >
              {loading() ? t('common.loading') : t('room.search.loadMore')}
            </button>
          </Show>
        </Show>
      </div>
    </aside>
  );
};
