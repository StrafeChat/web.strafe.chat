import type { Component } from 'solid-js';
import { For, Show, createEffect, createMemo, createSignal, on } from 'solid-js';
import {
  createRoomWebhook,
  deleteWebhook,
  patchWebhook,
  resetWebhookToken,
  webhookAvatarDataUri,
  WEBHOOK_TYPE_INCOMING,
  type Webhook,
  type WebhookWithToken,
} from '../../api/webhooks';
import { refreshRoomWebhooks, removeWebhook, upsertWebhook, webhooks } from '../../stores/webhooks';
import { confirmDialog } from '../../stores/confirmDialog';
import { translateCaughtApiError } from '../../lib/formatApiError';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { WebhookTag } from '../WebhookTag';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Toggle } from '../ui/Toggle';
import { IconButton } from '../ui/IconButton';
import { EmptyState } from '../ui/EmptyState';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { settingsGroupFrame } from './settingsChrome';
import { appDialogActions, zLayer } from '../../theme/appChrome';
import { formatDate, t } from '../../i18n';

/** Discord's name limit, and the server's (spec 3.3). */
const NAME_MAX = 80;

interface Props {
  spaceId: string;
  roomId: string;
  /** "#general", for the copy-now warning. */
  roomLabel: string;
  /** The viewer has Manage Webhooks in this room. */
  canManage: boolean;
  /** The viewer has Mention Everyone here: only then may they let a webhook ping @everyone. */
  canMentionEveryone: boolean;
  /** The room is end-to-end encrypted: no webhook can post into it. */
  encrypted: boolean;
}

/**
 * Room settings > Integrations > Webhooks: the room's incoming webhooks. Create (name and
 * avatar), then the URL once in a copy-now dialog; per webhook rename, change or clear the
 * avatar, allow @everyone and role pings (only with Mention Everyone), reset the URL (shown
 * once again), delete. The URL is never shown after that: lists carry no tokens.
 */
export const RoomWebhooksPage: Component<Props> = (props) => {
  const [loadErr, setLoadErr] = createSignal('');
  const [err, setErr] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [creating, setCreating] = createSignal(false);
  const [newName, setNewName] = createSignal('');
  const [newAvatar, setNewAvatar] = createSignal<string | undefined>();
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editName, setEditName] = createSignal('');
  /** undefined = unchanged, null = back to the default, a data URI = new image. */
  const [editAvatar, setEditAvatar] = createSignal<string | null | undefined>();
  const [editMass, setEditMass] = createSignal(false);
  /** The secret just minted (create or reset): shown once, kept nowhere else. */
  const [revealed, setRevealed] = createSignal<{ webhook: WebhookWithToken; reset: boolean } | null>(null);
  const [copied, setCopied] = createSignal(false);

  createEffect(
    on(
      () => [props.roomId, props.canManage] as const,
      ([roomId, can]) => {
        setLoadErr('');
        setEditingId(null);
        setCreating(false);
        if (!roomId || !can) return;
        void refreshRoomWebhooks(roomId).catch((e) => setLoadErr(translateCaughtApiError(e, t).join(' ')));
      }
    )
  );

  const list = createMemo(() => (webhooks.byRoom[props.roomId] ?? []).filter((w) => w.type === WEBHOOK_TYPE_INCOMING || !w.type));
  const loaded = () => webhooks.byRoom[props.roomId] !== undefined;
  const canCreate = () => props.canManage && !props.encrypted && !busy();

  function errorText(e: unknown): string {
    return translateCaughtApiError(e, t).join(' ');
  }

  async function pickAvatar(apply: (uri: string) => void) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/webp';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const r = await webhookAvatarDataUri(file);
      if ('error' in r) setErr(t(r.error));
      else {
        setErr('');
        apply(r.uri);
      }
    };
    input.click();
  }

  function startCreate() {
    setErr('');
    setNewName(t('webhooks.defaultName'));
    setNewAvatar(undefined);
    setCreating(true);
  }

  async function create() {
    const name = newName().trim();
    if (!name || !canCreate()) return;
    setBusy(true);
    setErr('');
    try {
      const w = await createRoomWebhook(props.roomId, { name, ...(newAvatar() ? { avatar: newAvatar() } : {}) });
      upsertWebhook(w);
      setCreating(false);
      setCopied(false);
      setRevealed({ webhook: w, reset: false });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(w: Webhook) {
    setErr('');
    setEditingId(w.id);
    setEditName(w.name);
    setEditAvatar(undefined);
    setEditMass(w.mass_mentions === true);
  }

  async function saveEdit(w: Webhook) {
    const name = editName().trim();
    if (!name) return;
    setBusy(true);
    setErr('');
    try {
      const body: Parameters<typeof patchWebhook>[1] = {};
      if (name !== w.name) body.name = name;
      if (editAvatar() !== undefined) body.avatar = editAvatar();
      if (editMass() !== (w.mass_mentions === true)) body.mass_mentions = editMass();
      if (Object.keys(body).length > 0) upsertWebhook(await patchWebhook(w.id, body));
      setEditingId(null);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function reset(w: Webhook) {
    const ok = await confirmDialog({
      title: t('webhooks.resetConfirmTitle', { name: w.name }),
      body: t('webhooks.resetConfirmBody'),
      confirmLabel: t('webhooks.resetUrl'),
      tone: 'danger',
      icon: 'fa-solid fa-rotate',
    });
    if (!ok) return;
    setBusy(true);
    setErr('');
    try {
      const fresh = await resetWebhookToken(w.id);
      upsertWebhook(fresh);
      setCopied(false);
      setRevealed({ webhook: fresh, reset: true });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(w: Webhook) {
    const ok = await confirmDialog({
      title: t('webhooks.deleteConfirmTitle', { name: w.name }),
      body: t('webhooks.deleteConfirmBody'),
      confirmLabel: t('webhooks.delete'),
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setErr('');
    try {
      await deleteWebhook(w.id);
      removeWebhook(props.roomId, w.id);
      if (editingId() === w.id) setEditingId(null);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* clipboard refused (insecure origin, permissions): the URL stays selectable */
    }
  }

  const creatorName = (w: Webhook) => (w.creator ? w.creator.display_name || w.creator.username : '');

  return (
    <div class="max-w-2xl space-y-4" data-room-webhooks>
      <p class="text-sm text-muted-foreground">
        {t('webhooks.intro')}{' '}
        <a href="/docs/rest/#webhooks" target="_blank" rel="noopener" class="text-primary hover:underline">
          {t('webhooks.docsLink')}
        </a>
      </p>

      <Show when={props.encrypted}>
        <div class="flex gap-2.5 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-sm text-foreground/90" role="note">
          <i class="fa-solid fa-lock mt-0.5 text-muted-foreground" aria-hidden="true" />
          <span>{t('webhooks.encryptedRoom')}</span>
        </div>
      </Show>

      <Show when={err()}>
        <p class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{err()}</p>
      </Show>

      <Show
        when={creating()}
        fallback={
          <div>
            <Button type="button" onClick={startCreate} disabled={!canCreate()}>
              <i class="fa-solid fa-plus me-1.5 text-xs" aria-hidden="true" />
              {t('webhooks.new')}
            </Button>
          </div>
        }
      >
        <div class={`${settingsGroupFrame} space-y-3`}>
          <p class="text-sm font-semibold text-foreground">{t('webhooks.new')}</p>
          <div class="flex items-end gap-3">
            <button
              type="button"
              class="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void pickAvatar((uri) => setNewAvatar(uri))}
              aria-label={t('webhooks.chooseAvatar')}
              data-tooltip={t('webhooks.chooseAvatar')}
            >
              <MessageAvatar name={newName()} avatar={newAvatar()} user={{ id: '0' }} class="size-14" />
              <span class="absolute -bottom-0.5 -end-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                <i class="fa-solid fa-camera" aria-hidden="true" />
              </span>
            </button>
            <div class="min-w-0 flex-1">
              <Input
                label={t('webhooks.name')}
                value={newName()}
                maxLength={NAME_MAX}
                onInput={(e) => setNewName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void create();
                }}
                disabled={busy()}
              />
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void create()} disabled={!canCreate() || !newName().trim()} loading={busy()}>
              {t('webhooks.create')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setCreating(false)} disabled={busy()}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </Show>

      <Show when={loadErr()}>
        <p class="text-sm text-destructive">{loadErr()}</p>
      </Show>

      <Show when={loaded() && list().length === 0 && !loadErr()}>
        <EmptyState icon="fa-solid fa-plug" title={t('webhooks.emptyTitle')} body={t('webhooks.emptyBody')} />
      </Show>

      <div class="space-y-2">
        <For each={list()}>
          {(w) => (
            <div class="rounded-xl border border-border/70 bg-card/10" data-webhook-row={w.id}>
              <div class="flex items-center gap-3 px-3 py-3">
                <MessageAvatar name={w.name} avatar={w.avatar} user={{ id: w.id }} class="size-10" />
                <div class="min-w-0 flex-1">
                  <div class="flex min-w-0 flex-wrap items-center gap-y-0.5">
                    <span class="min-w-0 max-w-full truncate text-sm font-semibold text-foreground">{w.name}</span>
                    <WebhookTag webhook size="xs" />
                    <Show when={w.mass_mentions}>
                      <span class="ms-1.5 shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        {t('webhooks.massMentionsOn')}
                      </span>
                    </Show>
                    <Show when={w.disabled_reason}>
                      <span class="ms-1.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {t('webhooks.disabledEncrypted')}
                      </span>
                    </Show>
                  </div>
                  <p class="text-xs leading-snug text-muted-foreground">
                    <Show when={creatorName(w)} fallback={t('webhooks.createdOn', { when: formatDate(w.created_at, { dateStyle: 'medium' }) })}>
                      {t('webhooks.createdByOn', { name: creatorName(w), when: formatDate(w.created_at, { dateStyle: 'medium' }) })}
                    </Show>
                    {' · '}
                    <Show when={w.last_used_at} fallback={t('webhooks.neverUsed')}>
                      {(last) => t('webhooks.lastUsed', { when: formatDate(last(), { dateStyle: 'medium', timeStyle: 'short' }) })}
                    </Show>
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-0.5">
                  <IconButton
                    icon="fa-solid fa-pen"
                    label={t('webhooks.edit')}
                    size="md"
                    active={editingId() === w.id}
                    disabled={!props.canManage || busy()}
                    onClick={() => (editingId() === w.id ? setEditingId(null) : startEdit(w))}
                  />
                  <IconButton
                    icon="fa-solid fa-rotate"
                    label={t('webhooks.resetUrl')}
                    size="md"
                    disabled={!props.canManage || busy()}
                    onClick={() => void reset(w)}
                  />
                  <IconButton
                    icon="fa-solid fa-trash"
                    label={t('webhooks.delete')}
                    size="md"
                    tone="danger"
                    disabled={!props.canManage || busy()}
                    onClick={() => void remove(w)}
                  />
                </div>
              </div>
              <Show when={editingId() === w.id}>
                <div class="space-y-3 border-t border-border/60 px-3 py-3">
                  <div class="flex items-end gap-3">
                    <div class="flex shrink-0 flex-col items-center gap-1.5">
                      <MessageAvatar
                        name={editName()}
                        avatar={editAvatar() === undefined ? w.avatar : editAvatar()}
                        user={{ id: w.id }}
                        class="size-14"
                      />
                    </div>
                    <div class="min-w-0 flex-1">
                      <Input
                        label={t('webhooks.name')}
                        value={editName()}
                        maxLength={NAME_MAX}
                        onInput={(e) => setEditName(e.currentTarget.value)}
                        disabled={busy()}
                      />
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" disabled={busy()} onClick={() => void pickAvatar((uri) => setEditAvatar(uri))}>
                      {t('webhooks.changeAvatar')}
                    </Button>
                    <Show when={(editAvatar() === undefined ? w.avatar : editAvatar())}>
                      <Button type="button" size="sm" variant="ghost" disabled={busy()} onClick={() => setEditAvatar(null)}>
                        {t('webhooks.removeAvatar')}
                      </Button>
                    </Show>
                  </div>
                  <div class="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-foreground">{t('webhooks.massMentions')}</p>
                      <p class="text-xs text-muted-foreground">
                        {props.canMentionEveryone ? t('webhooks.massMentionsHelp') : t('webhooks.massMentionsNeedsPermission')}
                      </p>
                    </div>
                    <Toggle
                      checked={editMass()}
                      onChange={setEditMass}
                      // Turning it off is always allowed; turning it on needs Mention Everyone.
                      disabled={busy() || (!props.canMentionEveryone && !editMass())}
                      label={t('webhooks.massMentions')}
                    />
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => void saveEdit(w)} disabled={busy() || !editName().trim()} loading={busy()}>
                      {t('common.save')}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={busy()}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>

      <Show when={revealed()}>
        {(r) => (
          <ResponsiveDialog
            size="md"
            zClass={zLayer.confirm}
            onClose={() => setRevealed(null)}
            title={r().reset ? t('webhooks.urlResetTitle') : t('webhooks.urlTitle')}
            icon="fa-solid fa-key"
            tone="warning"
          >
            <div class="space-y-3" data-webhook-url-dialog>
              <div class="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-foreground" role="alert">
                <i class="fa-solid fa-triangle-exclamation mt-0.5 text-amber-500" aria-hidden="true" />
                <span>{t('webhooks.urlOnce', { room: props.roomLabel })}</span>
              </div>
              <div class="flex items-center gap-2">
                <code class="min-w-0 flex-1 select-all break-all rounded-md bg-background/70 px-3 py-2 font-mono text-xs text-foreground">
                  {r().webhook.url}
                </code>
              </div>
              <p class="text-xs text-muted-foreground">{t('webhooks.urlHeaderHint')}</p>
              <div class={appDialogActions}>
                <Button variant="secondary" onClick={() => void copyUrl(r().webhook.url)}>
                  <i class={`fa-solid ${copied() ? 'fa-check' : 'fa-copy'} me-1.5 text-xs`} aria-hidden="true" />
                  {copied() ? t('common.copied') : t('webhooks.copyUrl')}
                </Button>
                <Button onClick={() => setRevealed(null)} data-autofocus>
                  {t('webhooks.done')}
                </Button>
              </div>
            </div>
          </ResponsiveDialog>
        )}
      </Show>
    </div>
  );
};
