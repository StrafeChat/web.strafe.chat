import type { Component } from 'solid-js';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { ApiError } from '../api/ApiError';
import { followAnnouncementRoom } from '../api/messages';
import { Button } from './ui/Button';
import { SearchInput } from './ui/SearchInput';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { appDialogActions, zLayer } from '../theme/appChrome';
import { spaces } from '../stores/spaces';
import { t } from '../i18n';

/** The announcement room being followed. */
export interface FollowSubject {
  roomId: string;
  roomName: string;
  spaceName: string;
}

const [subject, setSubject] = createSignal<FollowSubject | null>(null);

/** Open the follow picker. Mounted once in AppShell. */
export function openFollowDialog(s: FollowSubject): void {
  setSubject(s);
}

interface Target {
  id: string;
  name: string;
  space: string;
}

/**
 * Follow an announcement room into one of your rooms (Discord's "Follow"): what its moderators
 * publish then shows up there, posted under the announcement room's space. Any plain text room
 * of a space can be picked; the server decides (Manage Webhooks there, a room its instance
 * hosts) and the refusal is said in words.
 */
export const FollowAnnouncementDialog: Component = () => {
  const [query, setQuery] = createSignal('');
  const [picked, setPicked] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [done, setDone] = createSignal('');

  function close() {
    if (busy()) return;
    setSubject(null);
    setQuery('');
    setPicked('');
    setError('');
    setDone('');
  }

  const targets = createMemo((): Target[] => {
    const src = subject()?.roomId;
    const out: Target[] = [];
    for (const sp of spaces.spaces) {
      for (const r of spaces.spaceRoomsBySpaceId[sp.id] ?? []) {
        if (r.type !== 3 || r.id === src || r.e2ee_enabled === true) continue;
        out.push({ id: r.id, name: r.name, space: sp.name });
      }
    }
    return out;
  });

  const shown = createMemo(() => {
    const q = query().trim().toLowerCase();
    const list = q ? targets().filter((x) => `${x.name} ${x.space}`.toLowerCase().includes(q)) : targets();
    return list.slice(0, 100);
  });

  function reasonOf(err: unknown): string {
    if (err instanceof ApiError) {
      const code = err.code;
      if (code === 'already_following') return t('announcements.alreadyFollowing');
      if (code === 'managed_on_origin') return t('announcements.followElsewhere');
      if (code === 'webhook_limit') return t('announcements.followFull');
      if (code === 'room_encrypted') return t('announcements.followEncrypted');
      if (err.status === 403) return t('announcements.followNoPermission');
    }
    return t('announcements.followFailed');
  }

  async function follow() {
    const s = subject();
    const target = targets().find((x) => x.id === picked());
    if (!s || !target) return;
    setBusy(true);
    setError('');
    try {
      await followAnnouncementRoom(s.roomId, target.id);
      setDone(t('announcements.followed', { room: target.name, space: target.space }));
    } catch (err) {
      setError(reasonOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={subject()}>
      {(s) => (
        <ResponsiveDialog
          size="sm"
          zClass={zLayer.modalStacked}
          onClose={close}
          dismissible={!busy()}
          title={t('announcements.followTitle', { room: s().roomName })}
          description={done() ? undefined : t('announcements.followDescription', { space: s().spaceName })}
          icon="fa-solid fa-bullhorn"
        >
          <Show
            when={!done()}
            fallback={
              <div class="space-y-4">
                <p class="text-sm text-foreground" data-follow-done>{done()}</p>
                <div class={appDialogActions}>
                  <Button onClick={close}>{t('common.close')}</Button>
                </div>
              </div>
            }
          >
            <div class="space-y-3" data-follow-dialog>
              <SearchInput value={query()} onValueChange={setQuery} placeholder={t('announcements.followSearch')} aria-label={t('announcements.followSearch')} />
              <div class="max-h-72 space-y-0.5 overflow-y-auto pe-1" role="radiogroup" aria-label={t('announcements.followTarget')}>
                <For each={shown()} fallback={<p class="py-6 text-center text-sm text-muted-foreground">{t('announcements.followNone')}</p>}>
                  {(x) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={picked() === x.id}
                      class={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        picked() === x.id ? 'bg-primary/15 text-foreground' : 'hover:bg-muted/40'
                      }`}
                      onClick={() => setPicked(x.id)}
                      disabled={busy()}
                      data-follow-target={x.id}
                    >
                      <i class="fa-solid fa-hashtag w-4 text-center text-sm text-muted-foreground" aria-hidden="true" />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm">{x.name}</span>
                        <span class="block truncate text-xs text-muted-foreground">{x.space}</span>
                      </span>
                    </button>
                  )}
                </For>
              </div>
              <p class="text-xs text-muted-foreground">{t('announcements.followNote')}</p>
              <Show when={error()}>
                <p class="text-sm text-destructive" role="alert">{error()}</p>
              </Show>
              <div class={appDialogActions}>
                <Button type="button" variant="ghost" onClick={close} disabled={busy()}>
                  {t('common.cancel')}
                </Button>
                <Button type="button" onClick={() => void follow()} loading={busy()} disabled={!picked()}>
                  {t('announcements.follow')}
                </Button>
              </div>
            </div>
          </Show>
        </ResponsiveDialog>
      )}
    </Show>
  );
};
