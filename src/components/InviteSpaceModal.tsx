import type { Component } from 'solid-js';
import { createSignal, createEffect, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { createSpaceInvite } from '../api/spaces';
import { Button } from './ui/Button';
import { ResponsiveDialog } from './ui/ResponsiveDialog';

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

  async function fetchInvite(spaceId: string) {
    if (!spaceId || loading()) return;
    setLoading(true);
    setError('');
    try {
      const inv = await createSpaceInvite(spaceId);
      setCode(inv.code ?? '');
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
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
  }

  createEffect(() => {
    if (!props.open) return;
    const sid = props.spaceId;
    // When opened, lazily fetch an invite only if we don't already have one.
    if (sid && !code() && !loading()) {
      fetchInvite(sid);
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
      <Portal mount={document.body}>
        <ResponsiveDialog
          size="md"
          zClass="z-[220]"
          ariaLabelledby="invite-space-title"
          onBackdropClick={() => handleClose()}
          panelClass="flex w-full flex-col gap-4 px-6 pt-6 touch-manipulation"
        >
          <h2 id="invite-space-title" class="text-lg font-semibold text-foreground">
            Invite people to this space
          </h2>
          <p class="text-sm text-muted-foreground">
            Share this invite link with others so they can join your space.
          </p>
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-foreground">Invite link</label>
            <div
              class="min-h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-foreground break-all font-mono"
              aria-live="polite"
            >
              {loading() ? 'Creating invite…' : inviteDisplay() || 'Invite link will appear here'}
            </div>
          </div>
          <Show when={error()}>
            <p class="text-sm text-destructive">{error()}</p>
          </Show>
          <div class="flex justify-between gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleRegenerate} disabled={loading()}>
              {loading() ? 'Creating…' : 'Generate new link'}
            </Button>
            <div class="flex gap-2">
              <Button type="button" variant="outline" onClick={handleCopy} disabled={loading()}>
                {copied() ? 'Copied!' : 'Copy link'}
              </Button>
              <Button type="button" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        </ResponsiveDialog>
      </Portal>
    </Show>
  );
};

