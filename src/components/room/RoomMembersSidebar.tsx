import type { Component } from 'solid-js';
import { For, Show, createMemo } from 'solid-js';
import type { RoomParticipant } from '../../api/rooms';
import type { SpaceRole } from '../../api/spaces';
import { PresenceDot, presenceStatusLabel } from '../PresenceDot';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { presence } from '../../stores/presence';
import { showContextMenu, type ContextMenuItem } from '../../stores/contextMenu';
import { buildUserMenuItems } from '../../lib/userContextMenu';
import { appActivityRail, appSectionLabel } from '../../theme/appChrome';
import { highestHoistedRole, memberHighestRolePosition, spaceRoleColorHex } from '../../lib/spacePermissions';
import { openUserProfileFromParticipant } from '../../stores/userProfilePopover';
import { IconButton } from '../ui/IconButton';
import { t } from '../../i18n';

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
  /** Space channel: allow role edits from member profile popover when true. */
  spaceId?: string;
  spaceOwnerId?: string;
  canManageMemberRoles?: boolean;
  onSpaceMemberRolesUpdated?: () => void;
  /** Space context: Kick Members / Ban Members permission and the viewer's own highest
   * role position (Number.MAX_SAFE_INTEGER for the owner, who has no ceiling). A row's
   * kick/ban action only shows when the target's highest role is below this. */
  canKickMembers?: boolean;
  canBanMembers?: boolean;
  viewerHighestRolePosition?: number;
  onKickMember?: (userId: string) => void;
  onBanMember?: (userId: string) => void;
  /** Below md the member list is an overlay drawer swiped in from the right edge; this is
   * whether it is currently out. Ignored from md up, where it is a static column. */
  mobileOpen?: boolean;
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
    sections.push({ label: t('presence.online'), members: ungrouped });
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

const SectionLabel: Component<{ label: string; count: number }> = (props) => (
  <p class={`px-2 ${appSectionLabel}`}>{t('room.members.section', { label: props.label, count: props.count })}</p>
);

export const RoomMembersSidebar: Component<RoomMembersSidebarProps> = (props) => {
  const isCreator = () => props.creatorId != null && props.currentUserId === props.creatorId;
  const showHeader = () => props.showMembersHeader !== false;
  const listAriaLabel = () => props.listAriaLabel ?? t('room.members.groupAria');

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

  const rowProps = () => ({
    currentUserId: props.currentUserId,
    creatorId: props.creatorId,
    onMessageUser: props.onMessageUser,
    onRemoveMember: props.onRemoveMember,
    isCreator: isCreator(),
    spaceRoles: props.spaceRoles,
    spaceId: props.spaceId,
    roomId: props.roomId,
    spaceOwnerId: props.spaceOwnerId,
    canManageMemberRoles: props.canManageMemberRoles,
    onSpaceMemberRolesUpdated: props.onSpaceMemberRolesUpdated,
    canKickMembers: props.canKickMembers,
    canBanMembers: props.canBanMembers,
    viewerHighestRolePosition: props.viewerHighestRolePosition,
    onKickMember: props.onKickMember,
    onBanMember: props.onBanMember,
  });

  return (
    <aside
      class={`absolute inset-y-0 end-0 z-30 flex w-[78vw] max-w-xs flex-col overflow-hidden shadow-2xl shadow-black/40 transition-transform duration-[280ms] ease-out md:static md:z-auto md:w-60 md:max-w-none md:shrink-0 md:translate-x-0 md:shadow-none ${
        props.mobileOpen ? 'translate-x-0' : 'translate-x-full'
      } ${appActivityRail}`}
      aria-label={listAriaLabel()}
    >
      <Show when={showHeader()}>
        <div class="shrink-0 px-4 pt-4">
          <h2 class={appSectionLabel}>{t('room.members.section', { label: t('room.members.title'), count: props.participants.length })}</h2>
        </div>
      </Show>
      <div class={`min-h-0 flex-1 space-y-4 overflow-y-auto p-2 ${showHeader() ? 'pt-3' : 'pt-3'}`}>
        <Show when={partitioned().kind === 'simple'}>
          <Show when={simpleOnline().length > 0}>
            <div class="space-y-0.5">
              <SectionLabel label={t('presence.online')} count={simpleOnline().length} />
              <For each={simpleOnline()}>{(p) => <MemberRow p={p} {...rowProps()} />}</For>
            </div>
          </Show>
        </Show>

        <Show when={partitioned().kind === 'space'}>
          <For each={spaceOnlineSections()}>
            {(sec) => (
              <div class="space-y-0.5">
                <SectionLabel label={sec.label} count={sec.members.length} />
                <For each={sec.members}>{(p) => <MemberRow p={p} {...rowProps()} colorNameFromHoistedRole />}</For>
              </div>
            )}
          </For>
        </Show>

        <Show when={partitioned().offline.length > 0}>
          <div class="space-y-0.5">
            <SectionLabel label={t('presence.offline')} count={partitioned().offline.length} />
            <For each={partitioned().offline}>{(p) => <MemberRow p={p} {...rowProps()} dim />}</For>
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
  /** Offline rows render slightly faded, like Discord. */
  dim?: boolean;
  spaceId?: string;
  /** Where the report dialog says the member was seen, when opened from a room. */
  roomId?: string;
  spaceOwnerId?: string;
  canManageMemberRoles?: boolean;
  onSpaceMemberRolesUpdated?: () => void;
  canKickMembers?: boolean;
  canBanMembers?: boolean;
  viewerHighestRolePosition?: number;
  onKickMember?: (userId: string) => void;
  onBanMember?: (userId: string) => void;
}> = (props) => {
  const displayName = () => props.p.display_name || props.p.username || t('common.unknown');
  const isSelf = () => props.p.id === props.currentUserId;
  const isSpaceOwnerTarget = () => props.spaceOwnerId != null && props.p.id === props.spaceOwnerId;
  /** Discord-style hierarchy: can only kick/ban a member whose highest role is below ours. */
  const outranksTarget = createMemo(() => {
    const targetHighest = memberHighestRolePosition(undefined, props.spaceRoles, {
      roles: getMemberRoleIds(props.p),
    });
    return targetHighest < (props.viewerHighestRolePosition ?? -1);
  });
  const canKick = () =>
    props.spaceId != null && props.canKickMembers === true && !isSelf() && !isSpaceOwnerTarget() && outranksTarget();
  const canBan = () =>
    props.spaceId != null && props.canBanMembers === true && !isSelf() && !isSpaceOwnerTarget() && outranksTarget();

  const nameColorHex = createMemo(() => {
    if (!props.colorNameFromHoistedRole || !props.spaceRoles?.length) return undefined;
    const hr = highestHoistedRole(getMemberRoleIds(props.p), props.spaceRoles);
    return hr ? spaceRoleColorHex(hr.color) : undefined;
  });

  // Mirror the user area under the avatar: the member's custom status if set, otherwise the
  // status label ("Online" / "Idle" / …). Nothing when offline - a status line reads wrong
  // there (and for others invisible is already reported as offline).
  const subline = () => {
    const st = presence.byUser[props.p.id]?.status ?? props.p.presence?.status;
    if (st !== 'online' && st !== 'idle' && st !== 'dnd') return undefined;
    const custom = presence.byUser[props.p.id]?.custom_status ?? props.p.presence?.custom_status;
    return custom || presenceStatusLabel(st);
  };

  function openProfile(e: MouseEvent) {
    e.stopPropagation();
    const roles = props.spaceRoles;
    const sid = props.spaceId;
    const spaceRoleContext =
      sid != null && roles != null && roles.length > 0
        ? {
            spaceId: sid,
            spaceOwnerId: props.spaceOwnerId ?? '',
            subjectRoleIds: [...(getMemberRoleIds(props.p) ?? [])],
            spaceRoles: roles,
            canManageMemberRoles: props.canManageMemberRoles === true,
            viewerHighestPosition: props.viewerHighestRolePosition,
            onMemberRolesUpdated: props.onSpaceMemberRolesUpdated,
          }
        : null;
    openUserProfileFromParticipant({
      participant: props.p,
      anchor: e.currentTarget as HTMLElement,
      currentUserId: props.currentUserId,
      onMessageUser: props.onMessageUser,
      spaceRoles: props.spaceRoles,
      spaceRoleContext,
    });
  }

  return (
    <div
      class={`group/member flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50 ${
        props.dim ? 'opacity-60 hover:opacity-100' : ''
      }`}
      onContextMenu={(e) => {
        const extraItems: ContextMenuItem[] = [
          ...(props.isCreator && !isSelf() && props.onRemoveMember
            ? [{ label: t('room.members.removeFromGroup'), icon: 'fa-user-minus', danger: true, onClick: () => props.onRemoveMember?.(props.p.id) }]
            : []),
          ...(canKick() && props.onKickMember
            ? [{ label: t('room.members.kick'), icon: 'fa-user-minus', danger: true, onClick: () => props.onKickMember?.(props.p.id) }]
            : []),
          ...(canBan() && props.onBanMember
            ? [{ label: t('room.members.ban'), icon: 'fa-gavel', danger: true, onClick: () => props.onBanMember?.(props.p.id) }]
            : []),
        ];
        const items = buildUserMenuItems({
          userId: props.p.id,
          username: props.p.username,
          displayName: displayName(),
          discriminator: props.p.discriminator,
          currentUserId: props.currentUserId,
          onMessage: props.onMessageUser,
          spaceId: props.spaceId,
          roomId: props.roomId,
          extraItems,
        });
        if (items.length) showContextMenu(e, items);
      }}
    >
      <button
        type="button"
        class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md border-0 bg-transparent p-0 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={openProfile}
      >
        <div class="relative shrink-0">
          <MessageAvatar name={displayName()} avatar={props.p.avatar} class="size-8 text-[13px]" />
          <span class="absolute -bottom-px -end-px">
            <PresenceDot userId={props.p.id} class="size-3.5" />
          </span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-1.5 truncate text-sm font-medium leading-tight">
            <span
              class="truncate"
              style={nameColorHex() ? { color: nameColorHex()! } : undefined}
              classList={{ 'text-foreground': !nameColorHex() }}
            >
              {displayName()}
            </span>
            {props.creatorId != null && props.p.id === props.creatorId && (
              <i class="fa-solid fa-crown shrink-0 text-[10px] text-amber-400" title={t('room.members.owner')} aria-hidden="true" />
            )}
          </p>
          <Show when={subline()}>
            <p class="mt-0.5 truncate text-xs leading-snug text-muted-foreground">{subline()}</p>
          </Show>
        </div>
      </button>
      {props.isCreator && !isSelf() && props.onRemoveMember && (
        <IconButton
          size="sm"
          tone="danger"
          icon="fa-solid fa-user-minus"
          label={t('room.members.removeNamed', { name: displayName() })}
          title={t('room.members.removeFromGroup')}
          class="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/member:opacity-100"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.onRemoveMember?.(props.p.id);
          }}
        />
      )}
    </div>
  );
};
