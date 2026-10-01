import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createSpace, inviteCodeFromInput } from '../api/spaces';
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
  // "Have an invite?": a code, a code@instance, or a pasted invite link from any Strafe
  // instance - all land on the invite page, which previews and joins.
  const [invite, setInvite] = createSignal('');
  const [inviteError, setInviteError] = createSignal('');

  function handleJoin(e: Event) {
    e.preventDefault();
    const code = inviteCodeFromInput(invite());
    if (!code) {
      setInviteError(t('createSpace.invalidInvite'));
      return;
    }
    props.onClose();
    setInvite('');
    setInviteError('');
    navigate(`/invite/${encodeURIComponent(code)}`);
  }

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
        <form onSubmit={handleJoin} class="mt-5 flex flex-col gap-2 border-t border-border pt-4">
          <Input
            id="join-space-invite"
            label={t('createSpace.haveInvite')}
            type="text"
            value={invite()}
            onInput={(e) => {
              setInvite(e.currentTarget.value);
              setInviteError('');
            }}
            placeholder={t('createSpace.invitePlaceholder')}
            disabled={loading()}
            error={inviteError() || undefined}
            autocomplete="off"
          />
          <div class="flex justify-end">
            <Button type="submit" variant="outline" disabled={!invite().trim() || loading()}>
              {t('createSpace.joinWithInvite')}
            </Button>
          </div>
        </form>
      </ResponsiveDialog>
    </Show>
  );
};
