import type { Component } from 'solid-js';
import { For, Show, createEffect, createSignal, on } from 'solid-js';
import {
  DEFAULT_THREAD_AUTO_ARCHIVE,
  MAX_THREAD_NAME_LENGTH,
  THREAD_AUTO_ARCHIVE_OPTIONS,
  createThread,
  createThreadFromMessage,
} from '../api/threads';
import { upsertSpaceRoomFromPayload } from '../stores/spaces';
import { translateCaughtApiError } from '../lib/formatApiError';
import { Button } from './ui/Button';
import { Checkbox } from './ui/Checkbox';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { appDialogActions } from '../theme/appChrome';
import { t } from '../i18n';

export interface CreateThreadModalProps {
  open: boolean;
  spaceId: string;
  /** The text channel the thread goes in. */
  roomId: string;
  /** When starting from a message: its id and a one-line preview to suggest a name from. */
  starter?: { id: string; preview: string } | null;
  /** Whether the viewer may make the thread private (standalone threads only). */
  allowPrivate: boolean;
  /** Preselect the private option (the "New private thread" entry point). */
  privateDefault?: boolean;
  onClose: () => void;
  onCreated: (threadId: string) => void;
}

/** Discord's "Create Thread" dialog: a name, how long until it archives, and - for a thread
 * not started from a message - whether it is private. */
export const CreateThreadModal: Component<CreateThreadModalProps> = (props) => {
  const [name, setName] = createSignal('');
  const [autoArchive, setAutoArchive] = createSignal(String(DEFAULT_THREAD_AUTO_ARCHIVE));
  const [isPrivate, setIsPrivate] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) return;
        setName(props.starter ? props.starter.preview.slice(0, MAX_THREAD_NAME_LENGTH) : '');
        setAutoArchive(String(DEFAULT_THREAD_AUTO_ARCHIVE));
        setIsPrivate(!!props.privateDefault && props.allowPrivate && !props.starter);
        setError('');
      }
    )
  );

  const durationLabel = (minutes: number) => {
    switch (minutes) {
      case 60:
        return t('threads.autoArchive.hour');
      case 1440:
        return t('threads.autoArchive.day');
      case 4320:
        return t('threads.autoArchive.threeDays');
      default:
        return t('threads.autoArchive.week');
    }
  };

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const n = name().trim();
    if (!n) {
      setError(t('threads.nameRequired'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const input = { name: n, auto_archive_minutes: Number(autoArchive()) };
      const raw = props.starter
        ? await createThreadFromMessage(props.roomId, props.starter.id, input)
        : await createThread(props.roomId, { ...input, private: isPrivate() });
      const room = upsertSpaceRoomFromPayload(props.spaceId, raw);
      props.onClose();
      if (room) props.onCreated(room.id);
    } catch (err) {
      setError(translateCaughtApiError(err, t).join(' ') || t('threads.createFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Show when={props.open}>
      <ResponsiveDialog
        size="sm"
        icon="fa-solid fa-comments"
        onClose={() => !loading() && props.onClose()}
        dismissible={!loading()}
        title={props.starter ? t('threads.createFromMessageTitle') : t('threads.createTitle')}
        description={props.starter ? t('threads.createFromMessageBody') : t('threads.createBody')}
      >
        <form onSubmit={handleSubmit} class="flex flex-col gap-4">
          <Show when={props.starter}>
            {(s) => (
              <p class="truncate rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground" title={s().preview}>
                {s().preview}
              </p>
            )}
          </Show>
          <Input
            label={t('threads.nameLabel')}
            placeholder={t('threads.namePlaceholder')}
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            maxLength={MAX_THREAD_NAME_LENGTH}
            autofocus
            disabled={loading()}
            error={error()}
          />
          <Select label={t('threads.autoArchiveLabel')} value={autoArchive()} onValueChange={setAutoArchive}>
            <For each={THREAD_AUTO_ARCHIVE_OPTIONS}>{(m) => <option value={String(m)}>{durationLabel(m)}</option>}</For>
          </Select>
          <Show when={!props.starter && props.allowPrivate}>
            <Checkbox
              checked={isPrivate()}
              onChange={setIsPrivate}
              disabled={loading()}
              label={t('threads.privateLabel')}
              description={t('threads.privateHint')}
            />
          </Show>
          <div class={appDialogActions}>
            <Button type="button" variant="ghost" onClick={() => props.onClose()} disabled={loading()}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading()} disabled={loading()}>
              {t('threads.create')}
            </Button>
          </div>
        </form>
      </ResponsiveDialog>
    </Show>
  );
};
