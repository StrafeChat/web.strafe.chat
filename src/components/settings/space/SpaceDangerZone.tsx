import type { Component } from 'solid-js';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { deleteSpace, transferSpaceOwnership, type Space, type SpaceMember } from '../../../api/spaces';
import { addOrUpdateSpace, removeSpace } from '../../../stores/spaces';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Toggle } from '../../ui/Toggle';
import { ResponsiveDialog } from '../../ui/ResponsiveDialog';
import { appDialogActions, zLayer } from '../../../theme/appChrome';
import { settingsSectionTitle } from '../settingsChrome';
import { t } from '../../../i18n';

interface Props {
  spaceId: string;
  space: Space | undefined;
  members: SpaceMember[];
  viewerId: string | undefined;
  /** Called after the space is deleted, so the settings modal can close itself. */
  onDeleted?: () => void;
}

/**
 * The two things only a space owner can do, kept together at the bottom of Overview the
 * way Discord does: hand the space to someone else, and delete it. Both are irreversible
 * enough to ask twice - a transfer needs an explicit acknowledgement, a delete needs the
 * space's name typed out (which the server checks as well, so it holds for any client).
 */
export const SpaceDangerZone: Component<Props> = (props) => {
  const [transferOpen, setTransferOpen] = createSignal(false);
  const [deleteOpen, setDeleteOpen] = createSignal(false);
  const [newOwnerId, setNewOwnerId] = createSignal('');
  const [acknowledged, setAcknowledged] = createSignal(false);
  const [typedName, setTypedName] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  const isOwner = () => !!props.viewerId && props.space?.owner_id === props.viewerId;
  const spaceName = () => props.space?.name ?? '';
  const candidates = createMemo(() => props.members.filter((m) => m.id !== props.space?.owner_id));
  const memberName = (m: SpaceMember) => m.display_name || m.username;

  function openTransfer() {
    setNewOwnerId('');
    setAcknowledged(false);
    setError('');
    setTransferOpen(true);
  }

  function openDelete() {
    setTypedName('');
    setError('');
    setDeleteOpen(true);
  }

  async function transfer() {
    const target = newOwnerId();
    if (!target || !acknowledged() || busy()) return;
    setBusy(true);
    setError('');
    try {
      addOrUpdateSpace(await transferSpaceOwnership(props.spaceId, target));
      setTransferOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('spaceSettings.danger.transferFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    if (typedName().trim() !== spaceName() || busy()) return;
    setBusy(true);
    setError('');
    try {
      await deleteSpace(props.spaceId, spaceName());
      // The SPACE_DELETE event does this for every other member; doing it here too means
      // the person who pressed the button doesn't wait on a round trip through Redis.
      removeSpace(props.spaceId);
      setDeleteOpen(false);
      props.onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('spaceSettings.danger.deleteFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={isOwner()}>
      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('spaceSettings.danger.title')}</h3>
        <div class="divide-y divide-destructive/20 rounded-xl border border-destructive/40 bg-destructive/5">
          <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="text-[15px] font-semibold text-foreground">{t('spaceSettings.danger.transferTitle')}</p>
              <p class="mt-0.5 text-xs leading-snug text-muted-foreground">{t('spaceSettings.danger.transferBody')}</p>
            </div>
            <Button variant="outline" class="shrink-0" disabled={candidates().length === 0} onClick={openTransfer}>
              <i class="fa-solid fa-crown text-xs" aria-hidden="true" />
              {t('spaceSettings.danger.transferAction')}
            </Button>
          </div>
          <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="text-[15px] font-semibold text-foreground">{t('spaceSettings.danger.deleteTitle')}</p>
              <p class="mt-0.5 text-xs leading-snug text-muted-foreground">{t('spaceSettings.danger.deleteBody')}</p>
            </div>
            <Button variant="destructive" class="shrink-0" onClick={openDelete}>
              <i class="fa-solid fa-trash text-xs" aria-hidden="true" />
              {t('spaceSettings.danger.deleteAction')}
            </Button>
          </div>
        </div>
        <Show when={candidates().length === 0}>
          <p class="text-xs text-muted-foreground">{t('spaceSettings.danger.transferNoMembers')}</p>
        </Show>
      </section>

      <Show when={transferOpen()}>
        <ResponsiveDialog
          size="sm"
          zClass={zLayer.modalStacked}
          onClose={() => !busy() && setTransferOpen(false)}
          dismissible={!busy()}
          title={t('spaceSettings.danger.transferDialogTitle', { name: spaceName() })}
          description={t('spaceSettings.danger.transferBody')}
        >
          <div class="space-y-4">
            <Select
              label={t('spaceSettings.danger.transferSelect')}
              value={newOwnerId()}
              disabled={busy()}
              onValueChange={setNewOwnerId}
            >
              <option value="">{t('spaceSettings.danger.transferPick')}</option>
              <For each={candidates()}>
                {(m) => (
                  <option value={m.id}>
                    {memberName(m)}#{String(m.discriminator ?? 0).padStart(4, '0')}
                  </option>
                )}
              </For>
            </Select>
            <label class="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/20 p-3">
              <span class="text-sm text-foreground">{t('spaceSettings.danger.transferConfirm')}</span>
              <Toggle checked={acknowledged()} disabled={busy()} onChange={setAcknowledged} />
            </label>
            <Show when={error()}>
              <p class="text-xs text-destructive">{error()}</p>
            </Show>
            <div class={appDialogActions}>
              <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={busy()}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                loading={busy()}
                disabled={busy() || !newOwnerId() || !acknowledged()}
                onClick={() => void transfer()}
              >
                {t('spaceSettings.danger.transferAction')}
              </Button>
            </div>
          </div>
        </ResponsiveDialog>
      </Show>

      <Show when={deleteOpen()}>
        <ResponsiveDialog
          size="sm"
          zClass={zLayer.modalStacked}
          onClose={() => !busy() && setDeleteOpen(false)}
          dismissible={!busy()}
          title={t('spaceSettings.danger.deleteDialogTitle', { name: spaceName() })}
          description={t('spaceSettings.danger.deleteWarn')}
        >
          <div class="space-y-4">
            <Input
              label={t('spaceSettings.danger.deleteTypeName', { name: spaceName() })}
              value={typedName()}
              disabled={busy()}
              autocomplete="off"
              onInput={(e) => setTypedName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void destroy();
              }}
            />
            <Show when={error()}>
              <p class="text-xs text-destructive">{error()}</p>
            </Show>
            <div class={appDialogActions}>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy()}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                loading={busy()}
                disabled={busy() || typedName().trim() !== spaceName()}
                onClick={() => void destroy()}
              >
                {t('spaceSettings.danger.deleteAction')}
              </Button>
            </div>
          </div>
        </ResponsiveDialog>
      </Show>
    </Show>
  );
};
