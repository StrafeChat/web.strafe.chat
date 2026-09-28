import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import { createReport } from '../api/reports';
import { REPORT_REASONS, type ReportReason } from '../api/instance';
import { ApiError } from '../api/ApiError';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { appDialogActions, zLayer } from '../theme/appChrome';
import { auth } from '../stores/auth';
import { rooms, roomDisplayName } from '../stores/rooms';
import { spaces } from '../stores/spaces';
import { t } from '../i18n';

export interface ReportSubject {
  targetType: 'user' | 'space';
  targetId: string;
  /** Shown in the title so the person can see they are reporting the right thing. */
  targetName: string;
  /** Context an administrator will want: where it happened, and which message. */
  spaceId?: string;
  roomId?: string;
  roomName?: string;
  messageId?: string;
  /** The reporter's own copy of the message, offered as a starting point for details - the
   * server cannot read an encrypted room, so what they paste is the only record. */
  messageText?: string;
}

const [subject, setSubject] = createSignal<ReportSubject | null>(null);

/** Open the report form. Mounted once in AppShell, like the other module-level dialogs. */
export function openReportDialog(s: ReportSubject): void {
  setSubject(s);
}

const reasonRow =
  'w-full rounded-lg border px-3 py-2 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const reasonOn = 'border-primary bg-primary/15 text-foreground';
const reasonOff = 'border-border/70 bg-background/40 text-muted-foreground hover:bg-muted/30';

export const ReportDialog: Component = () => {
  const [reason, setReason] = createSignal<ReportReason | ''>('');
  const [details, setDetails] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [sent, setSent] = createSignal(false);

  function close() {
    if (busy()) return;
    setSubject(null);
    setReason('');
    setDetails('');
    setError('');
    setSent(false);
  }

  async function submit(e: Event) {
    e.preventDefault();
    const s = subject();
    const r = reason();
    if (!s || !r) return;
    setBusy(true);
    setError('');
    try {
      await createReport({
        target_type: s.targetType,
        target_id: s.targetId,
        space_id: s.spaceId,
        room_id: s.roomId,
        message_id: s.messageId,
        reason: r,
        details: details().trim() || undefined,
      });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError(t('report.duplicate'));
      else if (err instanceof ApiError && err.status === 429) setError(t('report.tooMany'));
      else setError(t('report.failed'));
    } finally {
      setBusy(false);
    }
  }

  // Resolved here rather than by every caller: a message row knows its room id, not its
  // name. Space rooms live under their space; anything else is a PM or group, named the
  // way the sidebar names it.
  const roomLabel = () => {
    const s = subject();
    if (!s?.roomId) return '';
    if (s.roomName) return s.roomName;
    if (s.spaceId) return spaces.spaceRoomsBySpaceId[s.spaceId]?.find((r) => r.id === s.roomId)?.name ?? '';
    const r = rooms.rooms.find((x) => x.id === s.roomId);
    return r && auth.user?.id ? roomDisplayName(r, auth.user.id) : '';
  };

  const title = () => {
    const s = subject();
    if (!s) return '';
    return s.targetType === 'space' ? t('report.titleSpace', { name: s.targetName }) : t('report.titleUser', { name: s.targetName });
  };

  return (
    <Show when={subject()}>
      {(s) => (
        <ResponsiveDialog
          size="sm"
          zClass={zLayer.modalStacked}
          onClose={close}
          dismissible={!busy()}
          title={title()}
          description={sent() ? undefined : t('report.description')}
          icon="fa-solid fa-flag"
          tone="danger"
        >
          <Show
            when={!sent()}
            fallback={
              <div class="space-y-4">
                <p class="text-sm text-foreground">{t('report.sent')}</p>
                <p class="text-sm text-muted-foreground">{t('report.sentBody')}</p>
                <div class={appDialogActions}>
                  <Button onClick={close}>{t('common.close')}</Button>
                </div>
              </div>
            }
          >
            <form onSubmit={submit} class="space-y-4">
              <Show when={s().messageId}>
                <p class="text-xs text-muted-foreground">
                  {t('report.messageContext', { room: roomLabel() || t('common.unknown') })}
                </p>
              </Show>
              <div class="space-y-1.5" role="radiogroup" aria-label={t('report.reasonLabel')}>
                <div class="text-xs font-medium text-muted-foreground">{t('report.reasonLabel')}</div>
                <For each={REPORT_REASONS}>
                  {(r) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={reason() === r}
                      class={`${reasonRow} ${reason() === r ? reasonOn : reasonOff}`}
                      onClick={() => setReason(r)}
                      disabled={busy()}
                    >
                      {t(`report.reasons.${r}`)}
                    </button>
                  )}
                </For>
              </div>
              <Textarea
                label={t('report.detailsLabel')}
                placeholder={t('report.detailsPlaceholder')}
                value={details()}
                onInput={(e) => setDetails(e.currentTarget.value)}
                maxlength={2000}
                disabled={busy()}
                hint={s().messageText && !details() ? t('report.detailsHint') : undefined}
              />
              <Show when={s().messageText && !details()}>
                <button
                  type="button"
                  class="text-xs text-primary hover:underline"
                  onClick={() => setDetails(s().messageText ?? '')}
                >
                  {t('report.pasteMessage')}
                </button>
              </Show>
              <Show when={error()}>
                <p class="text-sm text-destructive">{error()}</p>
              </Show>
              <div class={appDialogActions}>
                <Button type="button" variant="ghost" onClick={close} disabled={busy()}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" variant="destructive" loading={busy()} disabled={!reason()}>
                  {t('report.submit')}
                </Button>
              </div>
            </form>
          </Show>
        </ResponsiveDialog>
      )}
    </Show>
  );
};
