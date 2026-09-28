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

export interface RoomHeaderProps {
  headerIcon: string;
  name: string;
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
}

export const RoomHeader: Component<RoomHeaderProps> = (props) => (
  <div class={`${appPageHeader} justify-between gap-3`}>
    <div class="flex min-w-0 items-center gap-2">
      <MobileRailsOpenButton />
      <i class={`fa-solid ${props.headerIcon} shrink-0 text-muted-foreground`} aria-hidden="true" />
      <h1 class={`truncate ${appPageTitle}`}>{props.name}</h1>
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
