import { blockBridgedUser } from '../api/bridges';
import { confirmDialog } from '../stores/confirmDialog';
import { translateCaughtApiError } from './formatApiError';
import { bridgePlatformLabel } from './bridgePlatforms';
import { t } from '../i18n';

/**
 * Block a bridged person from one bridge (spec 5.6): their future messages, edits and reactions
 * through it are refused, and the bridge is told so it can say so on the other platform. Their
 * messages here stay (a moderator deletes those as usual). Kick Members, or Manage Messages in
 * the room; the server checks. Resolves true when the block went through.
 */
export async function confirmBlockBridgedUser(opts: {
  bridgeId: string;
  puppetId: string;
  name: string;
  platform?: string;
  platformName?: string;
}): Promise<boolean> {
  const platform = bridgePlatformLabel(opts.platform, opts.platformName);
  const ok = await confirmDialog({
    title: t('bridges.block.confirmTitle', { name: opts.name }),
    body: t('bridges.block.confirmBody', { name: opts.name, platform }),
    confirmLabel: t('bridges.block.action'),
    tone: 'danger',
    icon: 'fa-solid fa-user-slash',
  });
  if (!ok) return false;
  try {
    await blockBridgedUser(opts.bridgeId, opts.puppetId);
    return true;
  } catch (e) {
    await confirmDialog({
      title: t('bridges.block.failed'),
      body: translateCaughtApiError(e, t).join(' '),
      confirmLabel: t('common.close'),
      acknowledgeOnly: true,
    });
    return false;
  }
}
