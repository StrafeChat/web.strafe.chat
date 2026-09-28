import type { ContextMenuItem } from '../stores/contextMenu';
import { RelType, relationshipType } from '../stores/relationships';
import { putRelationship, blockUser, unblockUser } from '../api/relationships';
import { openReportDialog } from '../components/ReportDialog';
import { confirmDialog } from '../stores/confirmDialog';
import { t } from '../i18n';

export interface UserMenuContext {
  userId: string;
  username: string;
  displayName: string;
  discriminator?: number;
  currentUserId?: string;
  /** Opens a DM with the user. Omitted for self. */
  onMessage?: (userId: string) => void;
  /** Where a report says the user was seen. */
  spaceId?: string;
  roomId?: string;
  /** Context-specific actions (kick / ban / remove from group) appended after the universal ones. */
  extraItems?: ContextMenuItem[];
}

function formatTag(username: string, discriminator?: number): string {
  return discriminator != null ? `${username}#${String(discriminator).padStart(4, '0')}` : `@${username}`;
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

  if (!isSelf && rel !== RelType.Friend && rel !== RelType.OutgoingRequest && rel !== RelType.Blocked) {
    items.push({
      label: rel === RelType.IncomingRequest ? t('userMenu.acceptFriend') : t('friends.addFriend'),
      icon: 'fa-user-plus',
      onClick: () => void putRelationship(ctx.userId).catch(() => {}),
    });
  }

  items.push({
    label: t('userArea.copyUsername'),
    icon: 'fa-copy',
    onClick: () => void navigator.clipboard?.writeText(formatTag(ctx.username, ctx.discriminator)),
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
