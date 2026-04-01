import type { Component } from 'solid-js';
import { For, Show, createMemo } from 'solid-js';
import type { RoomParticipant } from '../../api/rooms';
import type { SpaceRole } from '../../api/spaces';
import { PresenceDot } from '../PresenceDot';
import { presence } from '../../stores/presence';
import { showContextMenu } from '../../stores/contextMenu';
import { appActivityRail } from '../../theme/appChrome';
import { highestHoistedRole, spaceRoleColorHex } from '../../lib/spacePermissions';

export interface RoomMembersSidebarProps {
  participants: RoomParticipant[];
  currentUserId: string | undefined;
  onMessageUser: (userId: string) => void;
  /** Group creator can remove members. */
  creatorId?: string;
  roomId?: string;
  onRemoveMember?: (userId: string) => void;
  /**
   * Space roles — when defined (including `[]` after load), use Discord-style hoisted sections.
   * When `undefined` (not a space, or roles still loading), use a simple Online / Offline split.
   */
  spaceRoles?: SpaceRole[];
  /** Show the top "Members — N" heading. Group DMs use true; space channel sidebar uses false. Default true. */
  showMembersHeader?: boolean;
  /** Accessible name for the sidebar (e.g. "Space members" vs "Group members"). */
  listAriaLabel?: string;
}

function getMemberRoleIds(p: RoomParticipant): string[] | undefined {
  const m = p as { roles?: string[] };
  if (!m.roles?.length) return undefined;
  return m.roles;
}

/** Online bucket: online, idle, dnd (not offline / invisible / unknown). */
function isMemberOnline(p: RoomParticipant): boolean {
  const st = presence.byUser[p.id]?.status ?? p.presence?.status;
  return st === 'online' || st === 'idle' || st === 'dnd';
}

function sortByDisplayName(a: RoomParticipant, b: RoomParticipant): number {
  return (a.display_name || a.username).localeCompare(b.display_name || b.username, undefined, {
    sensitivity: 'base',
  });
}

/** Discord-style: one section per hoisted role (by position), then "Online" for members with no hoisted role. */
function buildSpaceOnlineSections(
  online: RoomParticipant[],
  roles: SpaceRole[]
): { label: string; members: RoomParticipant[] }[] {
  const groupMap = new Map<string, RoomParticipant[]>();
  for (const p of online) {
    const hr = highestHoistedRole(getMemberRoleIds(p), roles);
    const key = hr ? hr.id : '__none__';
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(p);
  }

  const hoistedSorted = [...roles].filter((r) => r.hoist).sort((a, b) => b.position - a.position);
  const sections: { label: string; members: RoomParticipant[] }[] = [];

  for (const r of hoistedSorted) {
    const members = groupMap.get(r.id);
    if (members?.length) {
      members.sort(sortByDisplayName);
      sections.push({ label: r.name, members });
    }
  }

  const ungrouped = groupMap.get('__none__');
  if (ungrouped?.length) {
    ungrouped.sort(sortByDisplayName);
    sections.push({ label: 'Online', members: ungrouped });
  }

  return sections;
}

type Partitioned =
  | {
      kind: 'simple';
      online: RoomParticipant[];
      offline: RoomParticipant[];
    }
  | {
      kind: 'space';
      onlineSections: { label: string; members: RoomParticipant[] }[];
      offline: RoomParticipant[];
    };

export const RoomMembersSidebar: Component<RoomMembersSidebarProps> = (props) => {
  const isCreator = () => props.creatorId != null && props.currentUserId === props.creatorId;
  const showHeader = () => props.showMembersHeader !== false;
  const listAriaLabel = () => props.listAriaLabel ?? 'Group members';

  const partitioned = createMemo((): Partitioned => {
    const list = props.participants;
    const roles = props.spaceRoles;
    const online: RoomParticipant[] = [];
    const offline: RoomParticipant[] = [];
    for (const p of list) {
      if (isMemberOnline(p)) online.push(p);
      else offline.push(p);
    }
    offline.sort(sortByDisplayName);

    if (roles === undefined) {
      online.sort(sortByDisplayName);
      return { kind: 'simple', online, offline };
    }

    return {
      kind: 'space',
      onlineSections: buildSpaceOnlineSections(online, roles),
      offline,
    };
  });

  // Solid's <Show> doesn't narrow unions for TS, so keep explicit helpers
  // to satisfy the linter and avoid accidental property access on the wrong branch.
  const simpleOnline = createMemo(() => {
    const p = partitioned();
    return p.kind === 'simple' ? p.online : ([] as RoomParticipant[]);
  });
  const spaceOnlineSections = createMemo(() => {
    const p = partitioned();
    return p.kind === 'space'
      ? p.onlineSections
      : ([] as { label: string; members: RoomParticipant[] }[]);
  });

  return (
    <aside
      class={`hidden w-60 shrink-0 flex-col overflow-hidden md:flex md:flex-col ${appActivityRail}`}
      aria-label={listAriaLabel()}
    >
      <Show when={showHeader()}>
        <div class="px-3 pt-4 shrink-0">
          <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Members — {props.participants.length}
          </h2>
        </div>
      </Show>
      <div class={`flex-1 overflow-y-auto min-h-0 p-2 space-y-4 ${showHeader() ? '' : 'pt-3'}`}>
        <Show when={partitioned().kind === 'simple'}>
          <Show when={simpleOnline().length > 0}>
            <div class="space-y-1">
              <p class="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Online — {simpleOnline().length}
              </p>
              <For each={simpleOnline()}>
                {(p) => (
                  <MemberRow
                    p={p}
                    currentUserId={props.currentUserId}
                    creatorId={props.creatorId}
                    onMessageUser={props.onMessageUser}
                    onRemoveMember={props.onRemoveMember}
                    isCreator={isCreator()}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>

        <Show when={partitioned().kind === 'space'}>
          <For each={spaceOnlineSections()}>
            {(sec) => (
              <div class="space-y-1">
                <p class="px-2 text-[11px] font-semibold text-muted-foreground tracking-wide">
                  {sec.label} — {sec.members.length}
                </p>
                <For each={sec.members}>
                  {(p) => (
                    <MemberRow
                      p={p}
                      currentUserId={props.currentUserId}
                      creatorId={props.creatorId}
                      onMessageUser={props.onMessageUser}
                      onRemoveMember={props.onRemoveMember}
                      isCreator={isCreator()}
                      spaceRoles={props.spaceRoles}
                      colorNameFromHoistedRole
                    />
                  )}
                </For>
              </div>
            )}
          </For>
        </Show>

        <Show when={partitioned().offline.length > 0}>
          <div class="space-y-1">
            <p class="px-2 text-[11px] font-semibold text-muted-foreground tracking-wide">
              Offline — {partitioned().offline.length}
            </p>
            <For each={partitioned().offline}>
              {(p) => (
                <MemberRow
                  p={p}
                  currentUserId={props.currentUserId}
                  creatorId={props.creatorId}
                  onMessageUser={props.onMessageUser}
                  onRemoveMember={props.onRemoveMember}
                  isCreator={isCreator()}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </aside>
  );
};

const MemberRow: Component<{
  p: RoomParticipant;
  currentUserId: string | undefined;
  creatorId?: string;
  onMessageUser: (userId: string) => void;
  onRemoveMember?: (userId: string) => void;
  isCreator: boolean;
  /** When set with spaceRoles, tint display name with highest hoisted role color (Discord-style). */
  spaceRoles?: SpaceRole[];
  colorNameFromHoistedRole?: boolean;
}> = (props) => {
  const displayName = () => props.p.display_name || props.p.username || 'Unknown';
  const statusText = () => presence.byUser[props.p.id]?.custom_status ?? props.p.presence?.custom_status;
  const isSelf = () => props.p.id === props.currentUserId;

  const nameColorHex = createMemo(() => {
    if (!props.colorNameFromHoistedRole || !props.spaceRoles?.length) return undefined;
    const hr = highestHoistedRole(getMemberRoleIds(props.p), props.spaceRoles);
    return hr ? spaceRoleColorHex(hr.color) : undefined;
  });

  const subline = () => statusText() || `@${props.p.username}`;

  return (
    <div
      class="group/member flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/30 transition-colors cursor-context-menu"
      onContextMenu={(e) => {
        const tag =
          props.p.discriminator != null
            ? `${props.p.username}#${String(props.p.discriminator).padStart(4, '0')}`
            : `@${props.p.username}`;
        const items = [
          ...(!isSelf()
            ? [
                {
                  label: 'Message',
                  icon: 'fa-message' as const,
                  onClick: () => props.onMessageUser(props.p.id),
                },
              ]
            : []),
          {
            label: 'Copy username',
            icon: 'fa-copy' as const,
            onClick: () => navigator.clipboard.writeText(tag),
          },
          ...(props.isCreator && !isSelf() && props.onRemoveMember
            ? [
                {
                  label: 'Remove from group',
                  icon: 'fa-user-minus' as const,
                  danger: true as const,
                  onClick: () => props.onRemoveMember?.(props.p.id),
                },
              ]
            : []),
        ];
        if (items.length) showContextMenu(e, items);
      }}
    >
      <div class="relative shrink-0">
        <div class="size-8 rounded-full bg-muted flex items-center justify-center text-[13px] font-medium">
          {displayName()[0].toUpperCase()}
        </div>
        <span class="absolute bottom-[-1px] right-[-1px]">
          <PresenceDot userId={props.p.id} class="size-3.5" />
        </span>
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-[15px] leading-tight font-medium truncate flex items-center gap-1.5">
          <span
            class="truncate"
            style={nameColorHex() ? { color: nameColorHex()! } : undefined}
            classList={{ 'text-foreground': !nameColorHex() }}
          >
            {displayName()}
          </span>
          {props.creatorId != null && props.p.id === props.creatorId && (
            <i class="fa-solid fa-crown text-amber-400 text-[10px] shrink-0" title="Group owner" aria-hidden="true" />
          )}
        </p>
        <p class="text-[12px] leading-snug text-muted-foreground/90 truncate mt-0.5">{subline()}</p>
      </div>
      {props.isCreator && !isSelf() && props.onRemoveMember && (
        <button
          type="button"
          class="size-8 shrink-0 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/member:opacity-100 transition-opacity inline-flex items-center justify-center"
          title="Remove from group"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.onRemoveMember?.(props.p.id);
          }}
          aria-label={`Remove ${displayName()} from group`}
        >
          <i class="fa-solid fa-user-minus text-xs" />
        </button>
      )}
    </div>
  );
};
