import { formatHandle } from '../stores/instance';
import type { ContextMenuItem } from '../stores/contextMenu';
import { RelType, relationshipType } from '../stores/relationships';
import { putRelationship, blockUser, unblockUser } from '../api/relationships';
import { authorizeUrl } from '../api/developers';
import { openReportDialog } from '../components/ReportDialog';
import { confirmDialog } from '../stores/confirmDialog';
import { t } from '../i18n';
import { memberHighestRolePosition } from './spacePermissions';
import type { SpaceRole } from '../api/spaces';
import { openAppWindow } from './openWindow';

export interface UserMenuContext {
  userId: string;
  username: string;
  displayName: string;
  /** Federation: the user's home instance, so "copy username" yields name@domain for a remote user. */
  homeDomain?: string;
  currentUserId?: string;
  /** A bot account: it cannot be friended; the menu offers adding it to a space instead. */
  bot?: boolean;
  /** Opens a DM with the user. Omitted for self. */
  onMessage?: (userId: string) => void;
  /** Where a report says the user was seen. */
  spaceId?: string;
  roomId?: string;
  /** Context-specific actions (kick / ban / remove from group) appended after the universal ones. */
  extraItems?: ContextMenuItem[];
}

/**
 * The one right-click menu for a user, shared by member rows and message authors so both
 * offer the same actions: message, add/accept friend, copy username/id, block or unblock,
 * report - plus any caller-supplied extras (space moderation). Actions the current
 * relationship makes meaningless (add-friend when already friends/blocked) are omitted, and
 * everything but copy is hidden for your own entry.
 */
export function buildUserMenuItems(ctx: UserMenuContext): ContextMenuItem[] {
  const isSelf = !!ctx.currentUserId && ctx.userId === ctx.currentUserId;
  const rel = relationshipType(ctx.userId);
  const items: ContextMenuItem[] = [];

  if (!isSelf && ctx.onMessage) {
    items.push({ label: t('friends.actions.message'), icon: 'fa-message', onClick: () => ctx.onMessage!(ctx.userId) });
  }

  if (ctx.bot) {
    // A bot's user id is its application's client id, so its install link needs nothing
    // else; the consent page says so if the bot is private.
    items.push({
      label: t('profile.addToSpace'),
      icon: 'fa-robot',
      onClick: () => openAppWindow(authorizeUrl({ clientId: ctx.userId, scopes: ['bot'] })),
    });
  } else if (!isSelf && rel !== RelType.Friend && rel !== RelType.OutgoingRequest && rel !== RelType.Blocked) {
    items.push({
      label: rel === RelType.IncomingRequest ? t('userMenu.acceptFriend') : t('friends.addFriend'),
      icon: 'fa-user-plus',
      onClick: () => void putRelationship(ctx.userId).catch(() => {}),
    });
  }

  items.push({
    label: t('userArea.copyUsername'),
    icon: 'fa-copy',
    onClick: () => void navigator.clipboard?.writeText(formatHandle({ username: ctx.username, home_domain: ctx.homeDomain })),
  });
  items.push({
    label: t('userArea.copyUserId'),
    icon: 'fa-id-card',
    onClick: () => void navigator.clipboard?.writeText(ctx.userId),
  });

  if (!isSelf) {
    if (rel === RelType.Blocked) {
      items.push({ label: t('userMenu.unblock'), icon: 'fa-user-check', onClick: () => void unblockUser(ctx.userId).catch(() => {}) });
    } else {
      items.push({
        label: t('userMenu.block'),
        icon: 'fa-ban',
        danger: true,
        onClick: () => {
          void confirmDialog({
            title: t('userMenu.blockTitle', { name: ctx.displayName }),
            body: t('userMenu.blockBody'),
            confirmLabel: t('userMenu.block'),
            tone: 'danger',
          }).then((ok) => {
            if (ok) void blockUser(ctx.userId).catch(() => {});
          });
        },
      });
    }
    items.push({
      label: t('profile.report'),
      icon: 'fa-flag',
      danger: true,
      onClick: () =>
        openReportDialog({ targetType: 'user', targetId: ctx.userId, targetName: ctx.displayName, spaceId: ctx.spaceId, roomId: ctx.roomId }),
    });
  }

  if (ctx.extraItems?.length) items.push(...ctx.extraItems);
  return items;
}


export interface SpaceModerationContext {
  /** The space the target is being moderated in. Without it, only the group-DM remove applies. */
  spaceId?: string;
  targetUserId: string;
  /** The target's role ids, for the outranks check. */
  targetRoleIds?: string[];
  currentUserId?: string;
  spaceOwnerId?: string;
  spaceRoles?: SpaceRole[];
  /** Viewer's highest role position; kick/ban is offered only against a lower-ranked member. */
  viewerHighestRolePosition?: number;
  canKickMembers?: boolean;
  canBanMembers?: boolean;
  onKick?: (userId: string) => void;
  onBan?: (userId: string) => void;
  /** Group-DM creator removing a member (no space involved). */
  canRemoveFromGroup?: boolean;
  onRemoveFromGroup?: (userId: string) => void;
}

/**
 * Kick / ban / remove-from-group items, shared by member rows and message authors so both
 * menus offer the same moderation actions. The hierarchy rules mirror the server: never
 * yourself or the space owner, and only a member whose highest role sits below yours.
 */
export function buildSpaceModerationItems(ctx: SpaceModerationContext): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];
  const isSelf = !!ctx.currentUserId && ctx.targetUserId === ctx.currentUserId;

  if (ctx.canRemoveFromGroup && !isSelf && ctx.onRemoveFromGroup) {
    items.push({
      label: t('room.members.removeFromGroup'),
      icon: 'fa-user-minus',
      danger: true,
      onClick: () => ctx.onRemoveFromGroup!(ctx.targetUserId),
    });
  }

  if (ctx.spaceId == null || isSelf) return items;
  if (ctx.spaceOwnerId != null && ctx.targetUserId === ctx.spaceOwnerId) return items;
  const targetHighest = memberHighestRolePosition(undefined, ctx.spaceRoles, { roles: ctx.targetRoleIds });
  if (targetHighest >= (ctx.viewerHighestRolePosition ?? -1)) return items;

  if (ctx.canKickMembers && ctx.onKick) {
    items.push({ label: t('room.members.kick'), icon: 'fa-user-minus', danger: true, onClick: () => ctx.onKick!(ctx.targetUserId) });
  }
  if (ctx.canBanMembers && ctx.onBan) {
    items.push({ label: t('room.members.ban'), icon: 'fa-gavel', danger: true, onClick: () => ctx.onBan!(ctx.targetUserId) });
  }
  return items;
}
