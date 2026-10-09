import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { IconButton } from '../ui/IconButton';
import { logout } from '../../stores/auth';
import { confirmDialog } from '../../stores/confirmDialog';
import {
  activeDesktopAccountId,
  beginAddDesktopAccount,
  removeDesktopAccount,
  sortedDesktopAccounts,
  switchDesktopAccount,
  type DesktopAccount,
} from '../../desktop/accounts';
import { t } from '../../i18n';

const rowClass =
  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent/60';

/**
 * The "Switch accounts" part of the user popover, desktop only: every account on this
 * device (on this instance or another), one to add, and a sign-out for the current one.
 */
export const DesktopAccountSection: Component<{ onClose: () => void }> = (props) => {
  const navigate = useNavigate();
  const [open, setOpen] = createSignal(false);

  function signOut() {
    props.onClose();
    logout();
    navigate('/login');
  }

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
    <div class="border-t border-border/70 px-2 py-2">
      <button type="button" aria-expanded={open()} class={rowClass} onClick={() => setOpen((o) => !o)}>
        <i class="fa-solid fa-user-group w-4 text-center text-muted-foreground" aria-hidden="true" />
        {t('desktop.accounts.switch')}
        <i
          class={`fa-solid fa-chevron-right ms-auto text-xs text-muted-foreground transition-transform ${open() ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      </button>

      <Show when={open()}>
        <div class="my-1 space-y-0.5 rounded-xl bg-muted/25 p-1">
          <For each={sortedDesktopAccounts()}>
            {(acc) => {
              const active = () => acc.id === activeDesktopAccountId();
              return (
                <div class={`group flex items-center gap-1 rounded-lg ${active() ? 'bg-accent/40' : ''}`}>
                  <button
                    type="button"
                    class="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-start text-sm text-foreground transition-colors hover:bg-accent/60 disabled:cursor-default disabled:hover:bg-transparent"
                    disabled={active()}
                    aria-current={active() ? 'true' : undefined}
                    onClick={() => void switchDesktopAccount(acc.id)}
                  >
                    <MessageAvatar name={acc.displayName} avatar={acc.avatar} class="size-7 text-xs" />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate font-medium">{acc.displayName}</span>
                      <span class="block truncate text-[11px] text-muted-foreground" dir="ltr">
                        @{acc.username} · {acc.instance.domain}
                      </span>
                    </span>
                    <Show when={active()}>
                      <i class="fa-solid fa-check text-xs text-primary" aria-hidden="true" />
                    </Show>
                  </button>
                  <Show when={!active()}>
                    <IconButton
                      icon="fa-regular fa-trash-can"
                      label={t('desktop.accounts.remove')}
                      class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => void remove(acc)}
                    />
                  </Show>
                </div>
              );
            }}
          </For>
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-accent/60"
            onClick={() => void beginAddDesktopAccount()}
          >
            <span class="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
              <i class="fa-solid fa-plus text-xs" aria-hidden="true" />
            </span>
            {t('desktop.accounts.add')}
          </button>
        </div>
      </Show>

      <button type="button" class={`${rowClass} text-destructive hover:bg-destructive/10`} onClick={signOut}>
        <i class="fa-solid fa-right-from-bracket w-4 text-center" aria-hidden="true" />
        {t('desktop.accounts.signOut')}
      </button>
    </div>
  );
};
