import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { IconButton } from '../ui/IconButton';
import { authGlassSurface } from '../auth/authLayout';
import { appListRow, appListRowIdle, appSectionLabel } from '../../theme/appChrome';
import { removeDesktopAccount, sortedDesktopAccounts, switchDesktopAccount, type DesktopAccount } from '../../desktop/accounts';
import { confirmDialog } from '../../stores/confirmDialog';
import { t } from '../../i18n';

/**
 * On the sign-in page of the desktop app: the accounts already on this device, one click
 * from being back in. Shown under the form, which stays for signing in to another one.
 */
export const DesktopSavedAccounts: Component = () => {
  async function remove(acc: DesktopAccount) {
    const ok = await confirmDialog({
      title: t('desktop.accounts.remove'),
      body: t('desktop.accounts.removeConfirm', { name: acc.displayName, domain: acc.instance.domain }),
      confirmLabel: t('desktop.accounts.remove'),
      tone: 'danger',
    });
    if (ok) await removeDesktopAccount(acc.id);
  }

  return (
    <Show when={sortedDesktopAccounts().length > 0}>
      <section class={`mt-4 p-4 ${authGlassSurface} max-sm:rounded-2xl`} aria-label={t('desktop.accounts.saved')}>
        <p class={appSectionLabel}>{t('desktop.accounts.saved')}</p>
        <p class="mt-1 text-xs text-muted-foreground">{t('desktop.accounts.savedHint')}</p>
        <ul class="mt-3 space-y-1">
          <For each={sortedDesktopAccounts()}>
            {(acc) => (
              <li class="flex items-center gap-1">
                <button type="button" class={`${appListRow} ${appListRowIdle} flex-1`} onClick={() => void switchDesktopAccount(acc.id)}>
                  <MessageAvatar name={acc.displayName} avatar={acc.avatar} class="size-8 text-[13px]" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">{acc.displayName}</span>
                    <span class="block truncate text-xs text-muted-foreground" dir="ltr">
                      @{acc.username} · {acc.instance.domain}
                    </span>
                  </span>
                  <i class="fa-solid fa-chevron-right text-xs text-muted-foreground rtl:rotate-180" aria-hidden="true" />
                </button>
                <IconButton icon="fa-regular fa-trash-can" label={t('desktop.accounts.remove')} onClick={() => void remove(acc)} />
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
};
