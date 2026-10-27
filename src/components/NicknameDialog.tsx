import type { Component } from 'solid-js';
import { createEffect, createSignal, onMount, Show } from 'solid-js';
import { patchSpaceMember } from '../api/spaces';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { appDialogActions, zLayer } from '../theme/appChrome';
import { auth } from '../stores/auth';
import { ensureSpaceMembers, spaceMembers, upsertSpaceMember } from '../stores/spaceMembers';
import { closeNicknameDialog, nicknameDialogRequest, type NicknameDialogRequest } from '../stores/nicknameDialog';
import { resolveSpaceUser, spaceMemberOf } from '../lib/spaceProfile';
import { translateCaughtApiError } from '../lib/formatApiError';
import { inputMaxLength, spaceProfileFieldError } from '../lib/spaceProfileLimits';
import { t } from '../i18n';

/**
 * Change Nickname, for yourself or (as a moderator) someone else in a space. Mounted once in
 * AppShell and opened by id from every entry point - the member and author menus, the
 * profile card's pencil, Space Settings > Members - through stores/nicknameDialog. Who may
 * open it is decided there; the server checks again.
 */
export const NicknameDialog: Component = () => (
  // Keyed, so every open starts from that member's current nickname rather than whatever the
  // last one left in the field.
  <Show when={nicknameDialogRequest()} keyed>
    {(req) => <NicknameDialogBody req={req} />}
  </Show>
);

const NicknameDialogBody: Component<{ req: NicknameDialogRequest }> = (props) => {
  const spaceId = () => props.req.spaceId;
  const userId = () => props.req.userId;
  const isSelf = () => auth.user?.id === userId();
  const member = () => spaceMemberOf(spaceId(), userId());
  // Resolved from the store so the title follows the member list as it loads; yourself is
  // resolved against auth.user, the freshest copy of your own global profile.
  const profile = () => resolveSpaceUser(spaceId(), userId());

  const [value, setValue] = createSignal(member()?.nick ?? '');
  const [edited, setEdited] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  onMount(() => {
    // Opened from a surface that had the member at hand, the list is normally loaded; if not
    // (or it went stale on a reconnect) fetch it so the field starts from the real nickname.
    if (!member()) void ensureSpaceMembers(spaceId()).catch(() => undefined);
  });

  // Fill the field once the member arrives, unless the person has started typing.
  createEffect(() => {
    const nick = member()?.nick;
    if (!edited()) setValue(nick ?? '');
  });

  const currentNick = () => member()?.nick?.trim() ?? '';
  /** Why the server would refuse what is typed, translated; an unchanged value is not judged. */
  const problem = () => {
    const key = value().trim() === currentNick() ? undefined : spaceProfileFieldError('nick', value());
    return key ? t(key) : '';
  };

  function close() {
    if (busy()) return;
    closeNicknameDialog();
  }

  async function save(nick: string | null) {
    if (busy()) return;
    // Nothing to send: the server would answer with the unchanged member anyway.
    if ((nick ?? '') === currentNick()) {
      closeNicknameDialog();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const updated = await patchSpaceMember(spaceId(), isSelf() ? '@me' : userId(), { nick });
      // The API helpers never touch stores; this shows the new name before the gateway's
      // SPACE_MEMBER_UPDATE arrives. Only into a loaded list: one this started would hold a
      // single member, and an E2EE space room shares its Megolm key from that list.
      if (spaceMembers.bySpaceId[spaceId()]?.length) upsertSpaceMember(spaceId(), updated);
      setBusy(false);
      closeNicknameDialog();
    } catch (err) {
      setError(translateCaughtApiError(err, t).join(' ') || t('spaceProfile.dialog.failed'));
      setBusy(false);
    }
  }

  function onSubmit(e: Event) {
    e.preventDefault();
    if (problem()) return;
    void save(value().trim() || null);
  }

  const title = () =>
    isSelf() ? t('spaceProfile.dialog.titleSelf') : t('spaceProfile.dialog.titleOther', { name: profile().name });

  return (
    <ResponsiveDialog
      size="sm"
      // Above Space Settings, which opens this from its Members page.
      zClass={zLayer.modalStacked}
      onClose={close}
      dismissible={!busy()}
      title={title()}
      icon="fa-solid fa-pen"
    >
      <form onSubmit={onSubmit} class="space-y-4">
        <div class="space-y-1.5">
          <Input
            label={t('spaceProfile.dialog.label')}
            value={value()}
            maxLength={inputMaxLength('nick')}
            placeholder={profile().globalName}
            autocomplete="off"
            data-autofocus
            disabled={busy()}
            error={problem() || error() || undefined}
            onInput={(e) => {
              setEdited(true);
              setValue(e.currentTarget.value);
            }}
          />
          <p class="text-xs text-muted-foreground">{t('spaceProfile.dialog.hint')}</p>
        </div>
        <div class={`${appDialogActions} flex-wrap`}>
          <Show when={currentNick()}>
            <Button
              type="button"
              variant="ghost"
              class="me-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={busy()}
              onClick={() => void save(null)}
            >
              {t('spaceProfile.dialog.reset')}
            </Button>
          </Show>
          <Button type="button" variant="ghost" onClick={close} disabled={busy()}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={busy()} disabled={!!problem()}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
};
