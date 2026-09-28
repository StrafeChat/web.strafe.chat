import type { Component } from 'solid-js';
import { createSignal, createEffect, Show } from 'solid-js';
import { createSpaceInvite } from '../api/spaces';
import { Button } from './ui/Button';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { FieldError, fieldLabelClass } from './ui/Input';
import { appDialogActions } from '../theme/appChrome';
import { t } from '../i18n';

interface InviteSpaceModalProps {
  open: boolean;
  spaceId: string;
  onClose: () => void;
}

export const InviteSpaceModal: Component<InviteSpaceModalProps> = (props) => {
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [code, setCode] = createSignal('');
  const [copied, setCopied] = createSignal(false);
  // Space id the auto-fetch-on-open has already attempted, success or failure. Without this,
  // the effect below re-ran every time fetchInvite toggled `loading` (a signal it also reads
  // to decide whether to fetch) - on a failed attempt `code` never gets set, so the moment
  // `loading` flipped back to false the guard was satisfied again and it fetched again,
  // forever. This makes each open (per space) auto-fetch exactly once; retrying after a
  // failure is an explicit "Generate new link" click, not automatic.
  const [attemptedFor, setAttemptedFor] = createSignal('');

  async function fetchInvite(spaceId: string) {
    if (!spaceId || loading()) return;
    setAttemptedFor(spaceId);
    setLoading(true);
    setError('');
    try {
      const inv = await createSpaceInvite(spaceId);
      setCode(inv.code ?? '');
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invite.failed'));
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading()) return;
    props.onClose();
    setCode('');
    setError('');
    setCopied(false);
    setAttemptedFor('');
  }

  createEffect(() => {
    if (!props.open) return;
    const sid = props.spaceId;
    // When opened, fetch an invite once per space - not gated on `loading` (see attemptedFor).
    if (sid && !code() && attemptedFor() !== sid) {
      fetchInvite(sid);
    }
  });

  function inviteDisplay(): string {
    const c = code();
    if (!c) return '';
    if (typeof window === 'undefined') return c;
    return `${window.location.origin}/invite/${c}`;
  }

  async function handleCopy() {
    const url = inviteDisplay() || code();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function handleRegenerate() {
    setCode('');
    await fetchInvite(props.spaceId);
  }

  return (
    <Show when={props.open}>
      <ResponsiveDialog
        size="md"
        onClose={handleClose}
        dismissible={!loading()}
        title={t('space.invitePeople')}
        description={t('invite.description')}
      >
        <div class="flex flex-col gap-1.5">
          <label class={fieldLabelClass}>{t('invite.link')}</label>
          <div class="flex items-stretch gap-2">
            <div
              class="flex min-h-10 min-w-0 flex-1 items-center break-all rounded-lg border border-input bg-muted/40 px-3 py-2 font-mono text-sm text-foreground"
              aria-live="polite"
              dir="ltr"
            >
              <Show when={!loading()} fallback={<span class="text-muted-foreground">{t('invite.creating')}</span>}>
                <Show when={inviteDisplay()} fallback={<span class="text-muted-foreground">{t('invite.noLink')}</span>}>
                  {inviteDisplay()}
                </Show>
              </Show>
            </div>
            <Button type="button" class="shrink-0" onClick={handleCopy} disabled={loading() || !code()} data-autofocus>
              <i class={`fa-solid ${copied() ? 'fa-check' : 'fa-copy'} text-xs`} aria-hidden="true" />
              {copied() ? t('common.copied') : t('common.copy')}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">{t('invite.anyoneCanJoin')}</p>
        </div>
        <FieldError message={error() || undefined} />
        <div class={`${appDialogActions} mt-2 items-center`}>
          <Button type="button" variant="ghost" class="me-auto" onClick={handleRegenerate} disabled={loading()}>
            <i class="fa-solid fa-rotate text-xs" aria-hidden="true" />
            {t('invite.regenerate')}
          </Button>
          <Button type="button" variant="outline" onClick={handleClose}>
            {t('common.done')}
          </Button>
        </div>
      </ResponsiveDialog>
    </Show>
  );
};
