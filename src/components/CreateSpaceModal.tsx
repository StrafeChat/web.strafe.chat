import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createSpace } from '../api/spaces';
import { addOrUpdateSpace } from '../stores/spaces';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { appDialogActions } from '../theme/appChrome';
import { t } from '../i18n';

interface CreateSpaceModalProps {
  open: boolean;
  onClose: () => void;
}

export const CreateSpaceModal: Component<CreateSpaceModalProps> = (props) => {
  const navigate = useNavigate();
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const n = name().trim();
    setError('');
    if (!n) {
      setError(t('common.nameRequired'));
      return;
    }
    setLoading(true);
    try {
      const space = await createSpace({
        name: n,
        description: description().trim() || undefined,
      });
      addOrUpdateSpace(space);
      props.onClose();
      setName('');
      setDescription('');
      navigate(`/spaces/${space.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createSpace.failed'));
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading()) {
      props.onClose();
      setError('');
      setName('');
      setDescription('');
    }
  }

  return (
    <Show when={props.open}>
      <ResponsiveDialog
        size="md"
        onClose={handleClose}
        dismissible={!loading()}
        title={t('home.createSpace')}
        description={t('createSpace.description')}
      >
        <form onSubmit={handleSubmit} class="flex flex-col gap-4">
          <Input
            id="create-space-name"
            label={t('common.name')}
            type="text"
            value={name()}
            onInput={(e) => {
              setName(e.currentTarget.value);
              setError('');
            }}
            placeholder={t('createSpace.namePlaceholder')}
            maxLength={100}
            disabled={loading()}
            error={error() || undefined}
            autofocus
          />
          <Input
            id="create-space-desc"
            label={t('createSpace.descriptionLabel')}
            type="text"
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            placeholder={t('createSpace.descriptionPlaceholder')}
            maxLength={500}
            disabled={loading()}
          />
          <div class={appDialogActions}>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading()}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading()} disabled={!name().trim()}>
              {t('createSpace.submit')}
            </Button>
          </div>
        </form>
      </ResponsiveDialog>
    </Show>
  );
};
