import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { PresenceDot } from '../PresenceDot';
import { appHeaderBar } from '../../theme/appChrome';
import { MobileRailsOpenButton } from '../layout/MobileRailsOpenButton';

export interface RoomHeaderProps {
  headerIcon: string;
  name: string;
  pmOtherUserId: string | undefined;
  isGroup: boolean;
  messageCompact: boolean;
  onToggleCompact: () => void;
  hasPinned: boolean;
  pinnedOpen: boolean;
  onTogglePinned: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchFocus: () => void;
  membersPanelOpen: boolean;
  onToggleMembers: () => void;
  onAddPeople: () => void;
  /** When true and isGroup, show settings (cog) in the header button row. */
  isCreator?: boolean;
  /** Opens group settings modal (name, E2EE). Shown as cog next to add people when isCreator. */
  onOpenSettings?: () => void;
}

export const RoomHeader: Component<RoomHeaderProps> = (props) => (
  <div class={`flex h-12 shrink-0 items-center justify-between px-4 ${appHeaderBar}`}>
    <div class="flex min-w-0 items-center gap-2">
      <MobileRailsOpenButton />
      <i class={`fa-solid ${props.headerIcon} shrink-0 text-muted-foreground`} />
      <h1 class="text-base font-semibold text-foreground truncate">{props.name}</h1>
      <Show when={props.pmOtherUserId}>
        {(uid) => <PresenceDot userId={uid()} class="size-2 shrink-0 mt-0.5" />}
      </Show>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <button
        type="button"
        class={`size-8 inline-flex items-center justify-center rounded transition-colors ${
          props.pinnedOpen
            ? 'bg-accent text-accent-foreground'
            : props.hasPinned
              ? 'text-muted-foreground hover:text-foreground hover:bg-accent'
              : 'text-muted-foreground/60 hover:text-foreground hover:bg-accent'
        }`}
        title={props.hasPinned ? 'Pinned messages' : 'No pinned messages yet'}
        onClick={props.onTogglePinned}
        aria-label="Pinned messages"
        aria-pressed={props.pinnedOpen}
      >
        <i class="fa-solid fa-thumbtack text-sm" />
      </button>
      <Show when={props.isGroup}>
        <button
          type="button"
          class={`size-8 inline-flex items-center justify-center rounded transition-colors ${
            props.membersPanelOpen
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
          title={props.membersPanelOpen ? 'Hide members' : 'Show members'}
          onClick={props.onToggleMembers}
          aria-label={props.membersPanelOpen ? 'Hide members' : 'Show members'}
          aria-pressed={props.membersPanelOpen}
        >
          <i class="fa-solid fa-user-group text-sm" />
        </button>
        <button
          type="button"
          class="size-8 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Add people"
          onClick={props.onAddPeople}
          aria-label="Add people"
        >
          <i class="fa-solid fa-user-plus text-sm" />
        </button>
        <Show when={props.isCreator && props.onOpenSettings}>
          <button
            type="button"
            class="size-8 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Group settings"
            onClick={() => props.onOpenSettings?.()}
            aria-label="Group settings"
          >
            <i class="fa-solid fa-gear text-sm" />
          </button>
        </Show>
      </Show>
      <div class="hidden sm:flex items-center gap-2">
        <div class="relative">
          <span class="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[11px] text-muted-foreground">
            <i class="fa-solid fa-magnifying-glass" />
          </span>
          <input
            type="search"
            value={props.searchQuery}
            onInput={(e) => props.onSearchChange(e.currentTarget.value)}
            onFocus={props.onSearchFocus}
            placeholder="Search messages"
            class="w-44 md:w-56 h-8 rounded-md border border-input bg-background pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      {/* <button
        type="button"
        onClick={props.onToggleCompact}
        class="min-h-8 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded inline-flex items-center"
        title={props.messageCompact ? 'Switch to normal' : 'Switch to compact'}
      >
        {props.messageCompact ? 'Normal' : 'Compact'}
      </button> */}
    </div>
  </div>
);
