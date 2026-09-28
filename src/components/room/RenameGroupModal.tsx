import type { Component } from 'solid-js';
import { createSignal, createEffect, Show } from 'solid-js';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { appDialogActions } from '../../theme/appChrome';
import { t } from '../../i18n';

export interface RenameGroupModalProps {
  open: boolean;
  currentName: string;
  /** E2EE enabled (default true). Only group creator can change. */
  currentE2eeEnabled?: boolean;
  onSave: (opts: { name: string; e2ee_enabled: boolean }) => void | Promise<void>;
  onClose: () => void;
}

export const RenameGroupModal: Component<RenameGroupModalProps> = (props) => {
  const [name, setName] = createSignal(props.currentName);
  const [e2eeEnabled, setE2eeEnabled] = createSignal(props.currentE2eeEnabled !== false);
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  createEffect(() => {
    if (props.open) {
      setName(props.currentName);
      setE2eeEnabled(props.currentE2eeEnabled !== false);
      setError('');
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    const n = name().trim();
    setError('');
    if (!n) {
      setError(t('room.groupSettings.nameRequired'));
      return;
    }
    setLoading(true);
    Promise.resolve(props.onSave({ name: n, e2ee_enabled: e2eeEnabled() }))
      .then(() => props.onClose())
      .catch((err) => setError(err instanceof Error ? err.message : t('common.saveFailed')))
      .finally(() => setLoading(false));
  }

  function handleClose() {
    if (!loading()) {
      setName(props.currentName);
      setE2eeEnabled(props.currentE2eeEnabled !== false);
      setError('');
      props.onClose();
    }
  }

  return (
    <Show when={props.open}>
      <ResponsiveDialog
        size="sm"
        onClose={handleClose}
        dismissible={!loading()}
        title={t('room.groupSettings.title')}
        description={t('room.groupSettings.description')}
      >
        <form onSubmit={handleSubmit} class="space-y-4">
          <Input
            type="text"
            label={t('room.groupSettings.name')}
            placeholder={t('room.groupSettings.namePlaceholder')}
            value={name()}
            onInput={(e) => {
              setName(e.currentTarget.value);
              setError('');
            }}
            disabled={loading()}
            error={error() || undefined}
            autofocus
          />
          <Checkbox
            checked={e2eeEnabled()}
            onChange={setE2eeEnabled}
            disabled={loading()}
            label={t('room.groupSettings.e2ee')}
            description={t('room.groupSettings.e2eeDescription')}
          />
          <div class={appDialogActions}>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading()}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading()} disabled={!name().trim()}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </ResponsiveDialog>
    </Show>
  );
};
