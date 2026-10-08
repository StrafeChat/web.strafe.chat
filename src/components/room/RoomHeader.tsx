import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { PresenceDot } from '../PresenceDot';
import { appPageHeader, appPageTitle } from '../../theme/appChrome';
import { MobileRailsOpenButton } from '../layout/MobileRailsOpenButton';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { RoomNotifyMenu } from './RoomNotifyMenu';
import { MessageSearchBox } from './MessageSearchBox';
import type { SearchChannel, SearchIdentity } from '../../lib/messageSearch';
import { t } from '../../i18n';
import { BotTag } from '../BotTag';
import { OfficialTag } from '../OfficialTag';
import { showContextMenu, type ContextMenuItem } from '../../stores/contextMenu';

export interface RoomHeaderProps {
  /** A 1:1 PM with a bot: the BOT tag follows the name. */
  bot?: boolean;
  /** A 1:1 PM with the instance's official account: the OFFICIAL tag follows the name. */
  system?: boolean;
  headerIcon: string;
  name: string;
  /** Space channel topic, shown after the name behind a divider on a wide window only -
   * the header's button row and search box take ~400px, so below `lg` there is no honest
   * room for it (Discord hides it on narrow windows too). Hover gives the full text. */
  topic?: string;
  pmOtherUserId: string | undefined;
  /** Show the end-to-end-encrypted badge next to the name. */
  e2ee?: boolean;
  isGroup: boolean;
  messageCompact: boolean;
  onToggleCompact: () => void;
  hasPinned: boolean;
  pinnedOpen: boolean;
  onTogglePinned: () => void;
  /** Search box state - the header owns the input, the results live in RoomSearchPanel. */
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: (raw: string) => void;
  searchPeople?: SearchIdentity[];
  /** Space channels, so the box can offer `in:`. Omitted for PMs. */
  searchChannels?: SearchChannel[];
  /** Show the members toggle. Defaults to isGroup (group PMs); space channels pass true. */
  showMembersToggle?: boolean;
  membersPanelOpen: boolean;
  onToggleMembers: () => void;
  onAddPeople: () => void;
  /** When true and isGroup, show settings (cog) in the header button row. */
  isCreator?: boolean;
  /** Opens group settings modal (name, E2EE). Shown as cog next to add people when isCreator. */
  onOpenSettings?: () => void;
  notifyMode: number;
  muted: boolean;
  onSetNotifyMode: (mode: number) => void;
  onMute: (durationMs: number | null) => void;
  onUnmute: () => void;
  /** PMs and group PMs: start (or join) a call from the header. Omitted when voice is
   * off on this instance or the room cannot hold a call. */
  onStartCall?: (video: boolean) => void;
  /** A call is already running in this room (buttons read "join"). */
  callActive?: boolean;
  /** Space text channels: the thread browser toggle. */
  threadsOpen?: boolean;
  onToggleThreads?: () => void;
  /** Threads: the channel the thread lives in (a crumb back to it) and the thread's own
   * actions (join/leave, archive, lock, rename, delete) behind an ellipsis button. */
  parentName?: string;
  onOpenParent?: () => void;
  threadActions?: ContextMenuItem[];
}

export const RoomHeader: Component<RoomHeaderProps> = (props) => (
  <div class={`${appPageHeader} justify-between gap-3`}>
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <MobileRailsOpenButton />
      <Show when={props.parentName}>
        {(parent) => (
          <button
            type="button"
            class="hidden shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:flex"
            onClick={() => props.onOpenParent?.()}
            title={parent()}
          >
            <i class="fa-solid fa-hashtag text-[11px]" aria-hidden="true" />
            <span class="max-w-[10rem] truncate">{parent()}</span>
            <i class="fa-solid fa-chevron-right text-[9px]" aria-hidden="true" />
          </button>
        )}
      </Show>
      <i class={`fa-solid ${props.headerIcon} shrink-0 text-muted-foreground`} aria-hidden="true" />
      <h1 class={`flex min-w-0 items-center ${appPageTitle}`}>
        <span class="truncate">{props.name}</span>
        <BotTag bot={props.bot} size="sm" />
        <OfficialTag system={props.system} size="sm" />
      </h1>
      <Show when={props.pmOtherUserId}>
        {(uid) => <PresenceDot userId={uid()} class="mt-0.5 size-2 shrink-0" />}
      </Show>
      <Show when={props.e2ee}>
        <Tooltip label={t('room.e2eeBadge')} inline side="top">
          <span
            class="flex size-5 shrink-0 cursor-default items-center justify-center rounded-md bg-primary/15 text-primary"
            aria-label={t('room.e2eeBadge')}
          >
            <i class="fa-solid fa-lock text-[10px]" aria-hidden="true" />
          </span>
        </Tooltip>
      </Show>
      <Show when={props.topic?.trim()}>
        {(topic) => (
          <>
            <span class="hidden h-5 w-px shrink-0 bg-border/80 lg:block" aria-hidden="true" />
            {/* The topic is the part that gives way when the header is tight: it shrinks
                and truncates while the name keeps its width. */}
            <p class="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground lg:block" title={topic()}>
              {topic()}
            </p>
          </>
        )}
      </Show>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <Show when={props.onStartCall}>
        {(start) => (
          <>
            <IconButton
              icon="fa-solid fa-phone"
              label={props.callActive ? t('voice.joinCall') : t('room.callVoice')}
              tone={props.callActive ? 'default' : 'default'}
              class={props.callActive ? 'text-emerald-500 hover:text-emerald-400' : ''}
              onClick={() => start()(false)}
            />
            <IconButton
              icon="fa-solid fa-video"
              label={props.callActive ? t('voice.joinWithVideo') : t('room.callVideo')}
              class={props.callActive ? 'text-emerald-500 hover:text-emerald-400' : ''}
              onClick={() => start()(true)}
            />
          </>
        )}
      </Show>
      <RoomNotifyMenu
        notifyMode={props.notifyMode}
        muted={props.muted}
        onSetNotifyMode={props.onSetNotifyMode}
        onMute={props.onMute}
        onUnmute={props.onUnmute}
      />
      <Show when={props.onToggleThreads}>
        <IconButton
          icon="fa-solid fa-comments"
          label={t('threads.title')}
          active={props.threadsOpen}
          onClick={() => props.onToggleThreads?.()}
        />
      </Show>
      <Show when={props.threadActions?.length}>
        <IconButton
          icon="fa-solid fa-ellipsis"
          label={t('threads.actions')}
          onClick={(e) => showContextMenu(e, props.threadActions!)}
        />
      </Show>
      <IconButton
        icon="fa-solid fa-thumbtack"
        label={t('room.pinned')}
        title={props.hasPinned ? t('room.pinned') : t('room.noPinned')}
        active={props.pinnedOpen}
        tone={props.hasPinned ? 'default' : 'subtle'}
        onClick={props.onTogglePinned}
      />
      <Show when={props.showMembersToggle ?? props.isGroup}>
        <IconButton
          icon="fa-solid fa-user-group"
          label={props.membersPanelOpen ? t('room.hideMembers') : t('room.showMembers')}
          active={props.membersPanelOpen}
          onClick={props.onToggleMembers}
        />
      </Show>
      <Show when={props.isGroup}>
        <IconButton icon="fa-solid fa-user-plus" label={t('room.addPeople')} onClick={props.onAddPeople} />
        <Show when={props.isCreator && props.onOpenSettings}>
          <IconButton icon="fa-solid fa-gear" label={t('common.settings')} onClick={() => props.onOpenSettings?.()} />
        </Show>
      </Show>
      <MessageSearchBox
        value={props.searchQuery}
        onValueChange={props.onSearchQueryChange}
        onSubmit={props.onSearchSubmit}
        people={props.searchPeople}
        channels={props.searchChannels}
      />
    </div>
  </div>
);
