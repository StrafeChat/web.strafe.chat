import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { banSpaceMember } from '../../../api/spaces';
import { Button } from '../../ui/Button';
import { Textarea } from '../../ui/Textarea';
import { ResponsiveDialog } from '../../ui/ResponsiveDialog';
import { appDialogActions, zLayer } from '../../../theme/appChrome';
import { t } from '../../../i18n';

interface Props {
  spaceId: string;
  target: { id: string; name: string } | null;
  onClose: () => void;
  onBanned: (userId: string) => void;
}

/** Ban a member with an optional reason (shown in the bans tab and audit log). */
export const BanMemberDialog: Component<Props> = (props) => {
  const [reason, setReason] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  function close() {
    if (busy()) return;
    setReason('');
    setError('');
    props.onClose();
  }

  async function submit(e: Event) {
    e.preventDefault();
    const target = props.target;
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      await banSpaceMember(props.spaceId, target.id, reason().trim() || undefined);
      props.onBanned(target.id);
      setReason('');
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('spaceSettings.members.banFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={props.target}>
      {(target) => (
        <ResponsiveDialog
          size="sm"
          zClass={zLayer.modalStacked}
          onClose={close}
          dismissible={!busy()}
          title={t('spaceSettings.members.banTitle', { name: target().name })}
          description={t('spaceSettings.members.banBody')}
          icon="fa-solid fa-ban"
          tone="danger"
        >
          <form onSubmit={(e) => void submit(e)} class="space-y-4">
            <Textarea
              label={t('spaceSettings.members.banReason')}
              placeholder={t('spaceSettings.members.banReasonPlaceholder')}
              rows={3}
              maxLength={512}
              value={reason()}
              disabled={busy()}
              error={error() || undefined}
              onInput={(e) => setReason(e.currentTarget.value)}
              autofocus
            />
            <div class={appDialogActions}>
              <Button type="button" variant="outline" onClick={close} disabled={busy()}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="destructive" loading={busy()}>
                {t('room.members.ban')}
              </Button>
            </div>
          </form>
        </ResponsiveDialog>
      )}
    </Show>
  );
};
