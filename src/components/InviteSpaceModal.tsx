import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, createUniqueId, For, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { createSpaceInvite } from '../api/spaces';
import { createPM } from '../api/rooms';
import { Button } from './ui/Button';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { FieldError, fieldLabelClass } from './ui/Input';
import { MenuSelect } from './ui/MenuSelect';
import { SearchInput } from './ui/SearchInput';
import { MessageAvatar } from './messageList/MessageAvatar';
import { relationships, RelType, friendDisplayName } from '../stores/relationships';
import type { Relationship } from '../api/relationships';
import { addOrUpdateRoom } from '../stores/rooms';
import { sendMessage } from '../stores/messages';
import { formatHandle } from '../stores/instance';
import { appDialogActions, appMenuPanel, zLayer } from '../theme/appChrome';
import { t } from '../i18n';
import { publicWebOrigin } from '../lib/runtimeConfig';

interface InviteSpaceModalProps {
  open: boolean;
  spaceId: string;
  onClose: () => void;
}

const EXPIRY_OPTIONS = [0, 1800, 3600, 21600, 43200, 86400, 604800] as const;
const USES_OPTIONS = [0, 1, 5, 10, 25, 50, 100] as const;
const DEFAULT_MAX_AGE = '43200';
const DEFAULT_MAX_USES = '0';

export const InviteSpaceModal: Component<InviteSpaceModalProps> = (props) => {
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [code, setCode] = createSignal('');
  const [copied, setCopied] = createSignal(false);
  const [maxAge, setMaxAge] = createSignal(DEFAULT_MAX_AGE);
  const [maxUses, setMaxUses] = createSignal(DEFAULT_MAX_USES);
  const [appliedMaxAge, setAppliedMaxAge] = createSignal('');
  const [appliedMaxUses, setAppliedMaxUses] = createSignal('');
  const [friendsOpen, setFriendsOpen] = createSignal(false);
  const [friendQuery, setFriendQuery] = createSignal('');
  const [selected, setSelected] = createSignal<string[]>([]);
  const [sending, setSending] = createSignal(false);
  const [sentCount, setSentCount] = createSignal(0);
  const [sendError, setSendError] = createSignal('');
  const [attemptedFor, setAttemptedFor] = createSignal('');
  const friendsPanelId = `invite-friends-${createUniqueId()}`;
  const [friendsPos, setFriendsPos] = createSignal<{
    left: number;
    width: number;
    maxHeight: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  let friendsTriggerEl: HTMLButtonElement | undefined;
  let friendsPanelEl: HTMLDivElement | undefined;

  const friends = createMemo(() =>
    relationships.relationships
      .filter((rel) => rel.type === RelType.Friend)
      .slice()
      .sort((a, b) => friendDisplayName(a).localeCompare(friendDisplayName(b)))
  );

  const filteredFriends = createMemo(() => {
    const query = friendQuery().trim().toLowerCase();
    if (!query) return friends();
    return friends().filter((rel) => {
      const username = rel.user.username ?? '';
      const handle = formatHandle({ username, home_domain: rel.user.home_domain });
      return (
        friendDisplayName(rel).toLowerCase().includes(query) ||
        username.toLowerCase().includes(query) ||
        handle.toLowerCase().includes(query) ||
        rel.user.id.toLowerCase().includes(query)
      );
    });
  });

  const settingsDirty = createMemo(
    () =>
      Boolean(code()) &&
      (maxAge() !== appliedMaxAge() || maxUses() !== appliedMaxUses())
  );

  async function fetchInvite(spaceId: string) {
    if (!spaceId || loading()) return;
    const age = String(Number(maxAge()) || 0);
    const uses = String(Number(maxUses()) || 0);
    setAttemptedFor(spaceId);
    setLoading(true);
    setError('');
    setCopied(false);
    setSentCount(0);
    setSendError('');
    try {
      const inv = await createSpaceInvite(spaceId, {
        max_age_seconds: Number(age),
        max_uses: Number(uses),
      });
      setCode(inv.code ?? '');
      setAppliedMaxAge(age);
      setAppliedMaxUses(uses);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invite.failed'));
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading() || sending()) return;
    props.onClose();
    setCode('');
    setError('');
    setCopied(false);
    setAttemptedFor('');
    setMaxAge(DEFAULT_MAX_AGE);
    setMaxUses(DEFAULT_MAX_USES);
    setAppliedMaxAge('');
    setAppliedMaxUses('');
    setFriendsOpen(false);
    setFriendQuery('');
    setSelected([]);
    setSentCount(0);
    setSendError('');
  }

  createEffect(() => {
    if (!props.open) return;
    const sid = props.spaceId;
    if (sid && attemptedFor() !== sid) {
      void fetchInvite(sid);
    }
  });

  function positionFriendsPanel() {
    const trigger = friendsTriggerEl;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const gap = 6;
    const width = Math.min(rect.width, window.innerWidth - margin * 2);
    const left = Math.min(
      Math.max(margin, rect.left),
      Math.max(margin, window.innerWidth - width - margin)
    );
    const spaceAbove = rect.top - gap - margin;
    const maxHeight = Math.max(160, spaceAbove);
    setFriendsPos({ left, width, maxHeight, bottom: window.innerHeight - rect.top + gap });
  }

  createEffect(() => {
    if (!friendsOpen()) {
      setFriendsPos(null);
      return;
    }
    const raf = requestAnimationFrame(positionFriendsPanel);
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target && (friendsTriggerEl?.contains(target) || friendsPanelEl?.contains(target))) return;
      setFriendsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      setFriendsOpen(false);
      friendsTriggerEl?.focus({ preventScroll: true });
    };
    const onReflow = (e: Event) => {
      if (e.type === 'scroll') {
        const target = e.target as Node | null;
        if (target && friendsPanelEl?.contains(target)) return;
      }
      positionFriendsPanel();
    };
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    onCleanup(() => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    });
  });

  function changeExpiry(value: string) {
    if (value === maxAge() || loading()) return;
    setMaxAge(value);
  }

  function changeUses(value: string) {
    if (value === maxUses() || loading()) return;
    setMaxUses(value);
  }

  function inviteDisplay(): string {
    const c = code();
    if (!c) return '';
    if (typeof window === 'undefined') return c;
    // The instance's own address: in the desktop app the page's origin is tauri://localhost.
    return `${publicWebOrigin()}/invite/${c}`;
  }

  async function handleCopy() {
    const url = inviteDisplay() || code();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function handleRegenerate() {
    void fetchInvite(props.spaceId);
  }

  const expiryLabel = (seconds: number) =>
    seconds === 0
      ? t('spaceSettings.invites.never')
      : seconds < 3600
        ? t('spaceSettings.system.minutes', { count: seconds / 60 })
        : seconds < 86400
          ? t('spaceSettings.invites.hours', { count: seconds / 3600 })
          : t('spaceSettings.invites.days', { count: seconds / 86400 });

  const usesLabel = (count: number) =>
    count === 0 ? t('spaceSettings.invites.unlimited') : t('spaceSettings.invites.uses', { count });

  const handleLabel = (rel: Relationship): string =>
    rel.user.home_domain
      ? formatHandle({ username: rel.user.username, home_domain: rel.user.home_domain })
      : `@${rel.user.username ?? ''}`;

  function toggleFriend(userId: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, userId] : prev.filter((id) => id !== userId)));
    setSendError('');
    setSentCount(0);
  }

  async function sendToSelected() {
    const url = inviteDisplay();
    const ids = selected();
    if (!url || ids.length === 0 || sending()) return;
    setSending(true);
    setSendError('');
    setSentCount(0);
    const failed: string[] = [];
    let sent = 0;
    for (const id of ids) {
      try {
        const room = await createPM(id);
        addOrUpdateRoom(room);
        const message = await sendMessage(room.id, url);
        if (!message) throw new Error(t('room.sendFailed'));
        sent += 1;
      } catch {
        failed.push(id);
      }
    }
    setSelected(failed);
    setSending(false);
    if (failed.length > 0) setSendError(t('invite.sendFailed'));
    if (sent > 0) setSentCount(sent);
  }

  return (
    <Show when={props.open}>
      <ResponsiveDialog
        size="md"
        onClose={handleClose}
        dismissible={!loading() && !sending()}
        title={t('space.invitePeople')}
        description={t('invite.description')}
      >
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <label class={fieldLabelClass}>{t('invite.link')}</label>
            <div class="flex items-stretch overflow-hidden rounded-xl border border-input bg-background/80 transition-colors focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring">
              <div
                class="flex min-h-11 min-w-0 flex-1 items-center px-3 py-2 font-mono text-[13px] leading-snug text-foreground"
                aria-live="polite"
                dir="ltr"
              >
                <span class="break-all">
                  <Show when={!loading()} fallback={<span class="text-muted-foreground">{t('invite.creating')}</span>}>
                    <Show when={inviteDisplay()} fallback={<span class="text-muted-foreground">{t('invite.noLink')}</span>}>
                      {inviteDisplay()}
                    </Show>
                  </Show>
                </span>
              </div>
              <button
                type="button"
                class="flex shrink-0 items-center gap-2 border-s border-input bg-primary/10 px-3.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void handleCopy()}
                disabled={loading() || !code()}
                data-autofocus
              >
                <i class={`fa-solid ${copied() ? 'fa-check' : 'fa-copy'}`} aria-hidden="true" />
                {copied() ? t('common.copied') : t('common.copy')}
              </button>
            </div>
            <p class="text-xs text-muted-foreground">{t('invite.anyoneCanJoin')}</p>
          </div>

          <div class="space-y-2">
            <div class="grid gap-3 sm:grid-cols-2">
              <MenuSelect
                label={t('spaceSettings.invites.expireAfter')}
                value={maxAge()}
                options={EXPIRY_OPTIONS.map((seconds) => ({ value: String(seconds), label: expiryLabel(seconds) }))}
                onValueChange={changeExpiry}
                disabled={loading()}
              />
              <MenuSelect
                label={t('spaceSettings.invites.maxUses')}
                value={maxUses()}
                options={USES_OPTIONS.map((count) => ({ value: String(count), label: usesLabel(count) }))}
                onValueChange={changeUses}
                disabled={loading()}
              />
            </div>
            <p class="text-xs text-muted-foreground">{t('invite.settingsHint')}</p>
          </div>

          <Show when={settingsDirty()}>
            <div
              class="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-start"
              role="status"
            >
              <i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0 text-sm text-amber-500" aria-hidden="true" />
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground">{t('invite.settingsChangedTitle')}</p>
                <p class="mt-0.5 text-xs text-muted-foreground">{t('invite.settingsChangedBody')}</p>
              </div>
            </div>
          </Show>

          <FieldError message={error() || undefined} />

          <button
            ref={(el) => (friendsTriggerEl = el)}
            type="button"
            class="flex w-full items-center justify-between gap-3 rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            aria-expanded={friendsOpen()}
            aria-controls={friendsPanelId}
            disabled={sending()}
            onClick={() => setFriendsOpen((open) => !open)}
          >
            <span class="flex min-w-0 items-center gap-2.5 text-sm font-medium text-foreground">
              <i class="fa-solid fa-user-group text-xs text-muted-foreground" aria-hidden="true" />
              <span class="truncate">{t('invite.sendToFriends')}</span>
              <Show when={selected().length > 0}>
                <span class="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
                  {selected().length}
                </span>
              </Show>
            </span>
            <i
              class={`fa-solid ${friendsOpen() ? 'fa-chevron-up' : 'fa-chevron-down'} text-xs text-muted-foreground`}
              aria-hidden="true"
            />
          </button>

          <Show when={friendsOpen()}>
            <Portal mount={document.body}>
              <div
                ref={(el) => (friendsPanelEl = el)}
                id={friendsPanelId}
                class={`fixed ${zLayer.popover} ${appMenuPanel} flex flex-col overflow-hidden`}
                style={{
                  left: `${friendsPos()?.left ?? 0}px`,
                  top: friendsPos()?.top !== undefined ? `${friendsPos()!.top}px` : undefined,
                  bottom: friendsPos()?.bottom !== undefined ? `${friendsPos()!.bottom}px` : undefined,
                  width: `${friendsPos()?.width ?? 0}px`,
                  'max-height': `${friendsPos()?.maxHeight ?? 0}px`,
                  visibility: friendsPos() ? 'visible' : 'hidden',
                }}
                role="group"
                aria-label={t('invite.sendToFriends')}
                data-invite-friends-panel
              >
                <div class="p-1 pb-2">
                  <SearchInput
                    value={friendQuery()}
                    onValueChange={setFriendQuery}
                    placeholder={t('invite.searchFriends')}
                    aria-label={t('invite.searchFriends')}
                    size="sm"
                  />
                </div>
                <Show
                  when={filteredFriends().length > 0}
                  fallback={
                    <p class="px-2 py-6 text-center text-sm text-muted-foreground">
                      {friends().length === 0 ? t('invite.noFriends') : t('invite.noFriendsMatch')}
                    </p>
                  }
                >
                  <div class="max-h-[15.5rem] min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-1 pe-1">
                    <For each={filteredFriends()}>
                      {(rel) => (
                        <label class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60">
                          <input
                            type="checkbox"
                            class="size-4 shrink-0 cursor-pointer rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            checked={selected().includes(rel.user.id)}
                            onChange={(e) => toggleFriend(rel.user.id, e.currentTarget.checked)}
                          />
                          <MessageAvatar name={friendDisplayName(rel)} avatar={rel.user.avatar} class="size-8 text-xs" />
                          <span class="min-w-0 flex-1">
                            <span class="block truncate text-sm text-foreground">{friendDisplayName(rel)}</span>
                            <span class="block truncate text-xs text-muted-foreground">{handleLabel(rel)}</span>
                          </span>
                        </label>
                      )}
                    </For>
                  </div>
                </Show>
                <div class="mt-1 flex items-center justify-between gap-3 border-t border-border/60 px-1 pt-2">
                  <div class="min-w-0">
                    <Show when={sentCount() > 0}>
                      <p class="text-xs text-emerald-500">{t('invite.sent', { count: sentCount() })}</p>
                    </Show>
                    <Show when={sendError()}>
                      {(message) => <p class="text-xs text-destructive">{message()}</p>}
                    </Show>
                    <Show when={sentCount() === 0 && !sendError()}>
                      <p class="text-xs text-muted-foreground">{t('invite.friendsHint')}</p>
                    </Show>
                  </div>
                  <Button
                    size="sm"
                    class="shrink-0"
                    disabled={!code() || selected().length === 0 || sending()}
                    loading={sending()}
                    onClick={() => void sendToSelected()}
                  >
                    <i class="fa-solid fa-paper-plane text-xs" aria-hidden="true" />
                    {sending() ? t('invite.sending') : t('invite.send')}
                  </Button>
                </div>
              </div>
            </Portal>
          </Show>

          <div class={`${appDialogActions} items-center`}>
            <Button
              type="button"
              variant={settingsDirty() ? 'primary' : 'ghost'}
              class="me-auto"
              loading={loading()}
              onClick={handleRegenerate}
              disabled={loading() || sending()}
            >
              <i class="fa-solid fa-rotate text-xs" aria-hidden="true" />
              {t('invite.regenerate')}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading() || sending()}>
              {t('common.done')}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </Show>
  );
};
