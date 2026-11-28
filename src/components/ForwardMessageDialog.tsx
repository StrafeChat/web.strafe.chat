import type { Component } from 'solid-js';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { ApiError } from '../api/ApiError';
import { Button } from './ui/Button';
import { Checkbox } from './ui/Checkbox';
import { SearchInput } from './ui/SearchInput';
import { Textarea } from './ui/Textarea';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { appDialogActions, zLayer } from '../theme/appChrome';
import { auth } from '../stores/auth';
import { rooms, roomDisplayName } from '../stores/rooms';
import { spaces } from '../stores/spaces';
import { forwardMessage, sendMessage, type DecryptedMessage, type ForwardNames } from '../stores/messages';
import { MAX_FORWARD_TARGETS } from '../lib/forwardMessages';
import { t } from '../i18n';

/** What is being forwarded, and the names its mentions stand for. */
export interface ForwardSubject {
  message: DecryptedMessage;
  /** The space of the room it is in, when it is a space room. */
  spaceId?: string;
  names?: ForwardNames;
}

const [subject, setSubject] = createSignal<ForwardSubject | null>(null);

/** Open the forward picker. Mounted once in AppShell, like the other module-level dialogs. */
export function openForwardDialog(s: ForwardSubject): void {
  setSubject(s);
}

interface Destination {
  id: string;
  name: string;
  /** Where it is: the space's name, or empty for a PM or group. */
  where: string;
  icon: string;
  encrypted: boolean;
}

/**
 * The forward picker (Discord's): search your PMs, groups and space text rooms, pick up to five,
 * add a comment if you like, send. Each goes as its own forward (a server-built copy into a
 * plaintext room, one inside the ciphertext into an encrypted room), the comment as a message
 * after it. A message from an encrypted conversation can only go to encrypted ones - the others
 * are listed but cannot be picked, and say why.
 */
export const ForwardMessageDialog: Component = () => {
  const [query, setQuery] = createSignal('');
  const [picked, setPicked] = createSignal<string[]>([]);
  const [comment, setComment] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [failed, setFailed] = createSignal<{ name: string; reason: string }[]>([]);

  function close() {
    if (busy()) return;
    setSubject(null);
    setQuery('');
    setPicked([]);
    setComment('');
    setFailed([]);
  }

  const sourceEncrypted = () => subject()?.message.notEncrypted !== true;

  const destinations = createMemo((): Destination[] => {
    const uid = auth.user?.id ?? '';
    const out: Destination[] = [];
    const direct = [...rooms.rooms]
      .filter((r) => r.type === 1 || r.type === 2)
      .sort((a, b) => (b.last_message_id ?? '').localeCompare(a.last_message_id ?? '') || 0);
    for (const r of direct) {
      out.push({
        id: r.id,
        name: roomDisplayName(r, uid),
        where: '',
        icon: r.type === 2 ? 'fa-user-group' : 'fa-user',
        // PMs and groups are encrypted unless they were explicitly turned off.
        encrypted: r.e2ee_enabled !== false,
      });
    }
    for (const sp of spaces.spaces) {
      for (const r of spaces.spaceRoomsBySpaceId[sp.id] ?? []) {
        if (r.type !== 3) continue;
        out.push({ id: r.id, name: r.name, where: sp.name, icon: r.announcement ? 'fa-bullhorn' : 'fa-hashtag', encrypted: r.e2ee_enabled === true });
      }
    }
    return out;
  });

  const shown = createMemo(() => {
    const q = query().trim().toLowerCase();
    const list = q ? destinations().filter((d) => `${d.name} ${d.where}`.toLowerCase().includes(q)) : destinations();
    return list.slice(0, 80);
  });

  const allowed = (d: Destination) => !sourceEncrypted() || d.encrypted;

  function toggle(id: string, on: boolean) {
    setPicked((prev) => (on ? (prev.includes(id) || prev.length >= MAX_FORWARD_TARGETS ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
  }

  function reasonOf(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 403) return t('forward.noPermission');
      if (err.status === 429) return t('forward.slowDown');
    }
    return err instanceof Error && err.message ? err.message : t('forward.failed');
  }

  async function send() {
    const s = subject();
    if (!s || picked().length === 0) return;
    setBusy(true);
    setFailed([]);
    const errors: { name: string; reason: string }[] = [];
    const note = comment().trim();
    for (const id of picked()) {
      const d = destinations().find((x) => x.id === id);
      try {
        await forwardMessage(id, s.message, s.spaceId, s.names);
        if (note) await sendMessage(id, note);
      } catch (err) {
        errors.push({ name: d?.name ?? id, reason: reasonOf(err) });
      }
    }
    setBusy(false);
    if (errors.length) {
      setFailed(errors);
      return;
    }
    close();
  }

  return (
    <Show when={subject()}>
      <ResponsiveDialog
        size="sm"
        zClass={zLayer.modalStacked}
        onClose={close}
        dismissible={!busy()}
        title={t('forward.title')}
        description={t('forward.description', { max: MAX_FORWARD_TARGETS })}
        icon="fa-solid fa-share"
      >
        <div class="space-y-3" data-forward-dialog>
          <SearchInput value={query()} onValueChange={setQuery} placeholder={t('forward.search')} aria-label={t('forward.search')} />
          <Show when={sourceEncrypted()}>
            <p class="flex gap-2 text-xs text-muted-foreground" role="note">
              <i class="fa-solid fa-lock mt-0.5 text-primary" aria-hidden="true" />
              <span>{t('forward.encryptedOnly')}</span>
            </p>
          </Show>
          <div class="max-h-72 space-y-0.5 overflow-y-auto pe-1" role="group" aria-label={t('forward.destinations')}>
            <For each={shown()} fallback={<p class="py-6 text-center text-sm text-muted-foreground">{t('forward.none')}</p>}>
              {(d) => {
                const on = () => picked().includes(d.id);
                const full = () => !on() && picked().length >= MAX_FORWARD_TARGETS;
                return (
                  <div class={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${allowed(d) ? 'hover:bg-muted/40' : 'opacity-50'}`} data-forward-target={d.id}>
                    <i class={`fa-solid ${d.icon} w-4 text-center text-sm text-muted-foreground`} aria-hidden="true" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm text-foreground">
                        {d.name}
                        <Show when={d.encrypted}>
                          <i class="fa-solid fa-lock ms-1.5 text-[10px] text-primary" aria-label={t('room.e2eeBadge')} />
                        </Show>
                      </p>
                      <Show when={d.where || !allowed(d)}>
                        <p class="truncate text-xs text-muted-foreground">{allowed(d) ? d.where : t('forward.notEncrypted')}</p>
                      </Show>
                    </div>
                    <Checkbox
                      checked={on()}
                      onChange={(v) => toggle(d.id, v)}
                      disabled={busy() || !allowed(d) || full()}
                      label={d.name}
                      srOnlyLabel
                    />
                  </div>
                );
              }}
            </For>
          </div>
          <Textarea
            label={t('forward.comment')}
            placeholder={t('forward.commentPlaceholder')}
            value={comment()}
            onInput={(e) => setComment(e.currentTarget.value)}
            maxlength={4000}
            disabled={busy()}
          />
          <Show when={failed().length}>
            <div class="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" role="alert">
              <For each={failed()}>{(f) => <p>{t('forward.failedTo', { name: f.name, reason: f.reason })}</p>}</For>
            </div>
          </Show>
          <div class={appDialogActions}>
            <Button type="button" variant="ghost" onClick={close} disabled={busy()}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void send()} loading={busy()} disabled={picked().length === 0}>
              {picked().length > 1 ? t('forward.sendMany', { n: picked().length }) : t('forward.send')}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </Show>
  );
};
