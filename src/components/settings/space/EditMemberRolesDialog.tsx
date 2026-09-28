import type { Component } from 'solid-js';
import { createEffect, createSignal, For, Show } from 'solid-js';
import { setMemberSpaceRoles, type SpaceMember, type SpaceRole } from '../../../api/spaces';
import { spaceRoleColorHex } from '../../../lib/spacePermissions';
import { Button } from '../../ui/Button';
import { Toggle } from '../../ui/Toggle';
import { ResponsiveDialog } from '../../ui/ResponsiveDialog';
import { appDialogActions, zLayer } from '../../../theme/appChrome';
import { t } from '../../../i18n';

interface Props {
  spaceId: string;
  member: SpaceMember | null;
  roles: SpaceRole[];
  /** Roles at or above this position can't be handed out by the viewer (owner: Infinity). */
  viewerHighestPosition: number;
  onClose: () => void;
  onSaved: () => void;
}

/** Toggle a member's custom roles (the @everyone role always applies). */
export const EditMemberRolesDialog: Component<Props> = (props) => {
  const [picked, setPicked] = createSignal<Set<string>>(new Set());
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  createEffect(() => {
    const m = props.member;
    setPicked(new Set(m?.roles ?? []));
    setError('');
  });

  const custom = () => props.roles.filter((r) => r.name !== '@everyone').sort((a, b) => b.position - a.position);

  async function save() {
    const m = props.member;
    if (!m) return;
    setBusy(true);
    setError('');
    try {
      const chosen = custom().filter((r) => picked().has(r.id)).map((r) => r.id);
      await setMemberSpaceRoles(props.spaceId, m.id, chosen);
      props.onSaved();
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('spaceSettings.memberUpdateFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={props.member}>
      {(m) => (
        <ResponsiveDialog
          size="sm"
          zClass={zLayer.modalStacked}
          onClose={() => !busy() && props.onClose()}
          dismissible={!busy()}
          title={t('spaceSettings.members.editRolesTitle', { name: m().display_name || m().username })}
          description={t('spaceSettings.membersExplain')}
        >
          <div class="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border/60 bg-card/10 p-2">
            <For each={custom()}>
              {(role) => {
                const locked = () => role.position >= props.viewerHighestPosition;
                return (
                  <div class="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/20">
                    <span class="flex min-w-0 items-center gap-2 text-sm text-foreground">
                      <span class="size-2.5 shrink-0 rounded-full border border-border/40" style={{ 'background-color': spaceRoleColorHex(role.color ?? 0) }} />
                      <span class="truncate">{role.name}</span>
                      <Show when={locked()}>
                        <i class="fa-solid fa-lock text-[10px] text-muted-foreground" title={t('spaceSettings.members.roleLocked')} aria-hidden="true" />
                      </Show>
                    </span>
                    <Toggle
                      checked={picked().has(role.id)}
                      disabled={busy() || locked()}
                      onChange={(on) =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (on) next.add(role.id);
                          else next.delete(role.id);
                          return next;
                        })
                      }
                    />
                  </div>
                );
              }}
            </For>
            <Show when={custom().length === 0}>
              <p class="px-2 py-3 text-center text-sm text-muted-foreground">{t('spaceSettings.members.noCustomRoles')}</p>
            </Show>
          </div>
          <Show when={error()}>
            <p class="mt-3 text-xs text-destructive">{error()}</p>
          </Show>
          <div class={`${appDialogActions} mt-4`}>
            <Button variant="outline" onClick={props.onClose} disabled={busy()}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void save()} loading={busy()} disabled={busy()}>
              {t('common.save')}
            </Button>
          </div>
        </ResponsiveDialog>
      )}
    </Show>
  );
};
