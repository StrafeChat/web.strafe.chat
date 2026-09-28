import type { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createSignal, Show, For, onCleanup, onMount, createEffect } from 'solid-js';
import { Portal } from 'solid-js/web';
import { auth } from '../../stores/auth';
import { presence, setUserPresence, type UserPresence } from '../../stores/presence';
import { PresenceDot } from '../PresenceDot';
import { patchMe } from '../../api/users';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { openUserSettings } from '../../stores/userSettingsModal';
import { appMenuPopover, appUserDock, zLayer } from '../../theme/appChrome';
import { IconButton } from '../ui/IconButton';
import { Button } from '../ui/Button';
import { inputBaseClass } from '../ui/Input';
import { instance } from '../../stores/instance';
import { toggleDeafen, toggleMute, voice } from '../../stores/voice';
import { t } from '../../i18n';

const STATUS_OPTIONS: { id: UserPresence['status']; labelKey: string; color: string }[] = [
  { id: 'online', labelKey: 'presence.online', color: 'bg-primary' },
  { id: 'idle', labelKey: 'presence.idle', color: 'bg-yellow-500' },
  { id: 'dnd', labelKey: 'presence.dnd', color: 'bg-red-500' },
  { id: 'invisible', labelKey: 'presence.invisible', color: 'bg-muted-foreground/50' },
];

/** Label for a presence status; an offline self reads as "Invisible" (that is what it means for you). */
function statusLabel(status: string | undefined): string {
  switch (status) {
    case 'online':
    case 'idle':
    case 'dnd':
    case 'invisible':
      return t(`presence.${status}`);
    default:
      return t('presence.invisible');
  }
}

function formatDiscriminator(d: number): string {
  return String(d).padStart(4, '0');
}

export const UserArea: Component = () => {
  const navigate = useNavigate();
  const [isHovering, setIsHovering] = createSignal(false);
  const [popoverOpen, setPopoverOpen] = createSignal(false);
  const [popoverPos, setPopoverPos] = createSignal<{ left: number; bottom: number } | null>(null);
  const popoverWidth = 300;
  const [customStatusDraft, setCustomStatusDraft] = createSignal('');
  const [statusMenuOpen, setStatusMenuOpen] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  let areaEl: HTMLDivElement | undefined;

  const userId = () => auth.user?.id ?? '';
  const p = () => (userId() ? presence.byUser[userId()] : undefined);
  const displayName = () => auth.user?.display_name || auth.user?.username || '';
  const username = () => auth.user?.username || '';
  const discriminator = () => auth.user?.discriminator ?? 0;
  const discriminatorStr = () => formatDiscriminator(discriminator());

  const statusText = () => {
    const pres = p();
    if (pres?.custom_status) return pres.custom_status;
    return statusLabel(pres?.status);
  };

  const subtitleText = () => (isHovering() ? `${username()}#${discriminatorStr()}` : statusText());

  function handleDocumentClick(e: MouseEvent) {
    const target = e.target as Node;
    if (popoverOpen() && !document.getElementById('user-popover')?.contains(target) && !areaEl?.contains(target)) {
      setPopoverOpen(false);
      setStatusMenuOpen(false);
    }
  }

  function copyUserId() {
    if (userId()) {
      navigator.clipboard.writeText(userId());
    }
  }

  function copyDiscriminator() {
    navigator.clipboard.writeText(`${username()}#${discriminatorStr()}`);
  }

  async function setStatus(status: UserPresence['status']) {
    setUserPresence(userId(), { ...p(), status });
    setStatusMenuOpen(false);
    setSaving(true);
    try {
      await patchMe({ presence: { status } });
    } finally {
      setSaving(false);
    }
  }

  async function setCustomStatus() {
    const text = customStatusDraft().trim();
    const current = p();
    setUserPresence(userId(), {
      status: current?.status ?? 'online',
      custom_status: text || undefined,
    });
    setCustomStatusDraft('');
    setSaving(true);
    try {
      await patchMe({ presence: { custom_status: text || undefined } });
    } finally {
      setSaving(false);
    }
  }

  createEffect(() => {
    if (popoverOpen()) {
      setCustomStatusDraft(p()?.custom_status ?? '');
      const el = areaEl;
      if (el) {
        const rect = el.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const left = Math.max(12, Math.min(center - popoverWidth / 2, window.innerWidth - popoverWidth - 12));
        const bottom = window.innerHeight - rect.top + 8;
        setPopoverPos({ left, bottom });
      } else {
        setPopoverPos({ left: 12, bottom: 80 });
      }
    } else {
      setPopoverPos(null);
    }
  });

  createEffect(() => {
    if (!popoverOpen()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopoverOpen(false);
        setStatusMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  onMount(() => {
    document.addEventListener('click', handleDocumentClick);
    onCleanup(() => document.removeEventListener('click', handleDocumentClick));
  });

  const currentStatusColor = () =>
    STATUS_OPTIONS.find((s) => s.id === (p()?.status ?? 'offline'))?.color ?? 'bg-muted-foreground/50';

  return (
    <>
      <div
        ref={(el) => {
          areaEl = el;
        }}
        class={`relative flex items-center gap-1 px-2 py-2 ${appUserDock}`}
      >
        <div
          id="user-area-trigger"
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-expanded={popoverOpen()}
          class={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-accent/50 ${
            popoverOpen() ? 'bg-accent/50' : ''
          }`}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onClick={() => setPopoverOpen((o) => !o)}
          onKeyDown={(e) => e.key === 'Enter' && setPopoverOpen((o) => !o)}
        >
          <div class="relative shrink-0">
            <MessageAvatar name={displayName()} avatar={auth.user?.avatar} class="size-8 text-[13px]" />
            <span class="absolute -bottom-px -right-px">
              <PresenceDot userId={userId()} class="size-3.25" />
            </span>
          </div>
          <div class="min-w-0 flex-1 text-left">
            <div class="truncate text-xs font-semibold text-foreground">{displayName()}</div>
            <div class="truncate text-[11px] leading-tight text-muted-foreground">{subtitleText()}</div>
          </div>
        </div>
        {/* Mute / deafen sit here permanently, as on Discord, so they are one click away
            whether or not a call is up; they also set the state a later join starts with. */}
        <Show when={instance.voiceEnabled}>
          <IconButton
            icon={`fa-solid ${voice.session.selfMute || voice.session.selfDeaf ? 'fa-microphone-slash' : 'fa-microphone'}`}
            label={voice.session.selfMute || voice.session.selfDeaf ? t('voice.unmute') : t('voice.mute')}
            class={voice.session.selfMute || voice.session.selfDeaf ? 'text-destructive hover:text-destructive' : ''}
            aria-pressed={voice.session.selfMute || voice.session.selfDeaf}
            onClick={toggleMute}
          />
          <IconButton
            icon={`fa-solid ${voice.session.selfDeaf ? 'fa-volume-xmark' : 'fa-headphones'}`}
            label={voice.session.selfDeaf ? t('voice.undeafen') : t('voice.deafen')}
            class={voice.session.selfDeaf ? 'text-destructive hover:text-destructive' : ''}
            aria-pressed={voice.session.selfDeaf}
            onClick={toggleDeafen}
          />
        </Show>
        <IconButton
          icon="fa-solid fa-gear"
          label={t('common.settings')}
          onClick={() => {
            setPopoverOpen(false);
            openUserSettings();
          }}
        />
      </div>

      <Show when={popoverOpen() && popoverPos()}>
        {(pos) => (
          <Portal>
            <div
              id="user-popover"
              data-modal
              role="dialog"
              aria-label={t('userArea.dialogLabel')}
              class={`fixed ${zLayer.popover} max-h-[85vh] w-[300px] overflow-x-hidden overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${appMenuPopover}`}
              style={{
                left: `${pos().left}px`,
                bottom: `${pos().bottom}px`,
              }}
            >
              {/* Banner */}
              <div
                class="h-16 rounded-t-3xl bg-gradient-to-br from-primary/50 via-primary/25 to-primary/10 bg-cover bg-center"
                style={
                  auth.user?.banner
                    ? { 'background-image': `url(${auth.user.banner})` }
                    : {
                        'background-image': 'radial-gradient(circle, rgba(255,255,255,0.14) 1px, transparent 1px)',
                        'background-size': '14px 14px',
                      }
                }
              />

              {/* Avatar + name */}
              <div class="-mt-10 px-5 pb-3">
                <div class="relative inline-block">
                  <MessageAvatar
                    name={displayName()}
                    avatar={auth.user?.avatar}
                    class="size-20 border-4 border-popover bg-primary text-2xl font-semibold text-primary-foreground shadow-lg shadow-black/30"
                  />
                  <span class="absolute bottom-0.5 right-0.5">
                    <PresenceDot userId={userId()} class="size-5" borderClass="border-popover" />
                  </span>
                </div>
                <h3 class="mt-2.5 text-lg font-semibold leading-tight text-foreground">{displayName()}</h3>
                <button
                  type="button"
                  onClick={copyDiscriminator}
                  class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  title={t('userArea.copyUsername')}
                >
                  {username()}#{discriminatorStr()}
                  <i class="fa-regular fa-copy text-[10px]" aria-hidden="true" />
                </button>
              </div>

              {/* Custom status */}
              <div class="px-5 pb-4">
                <label for="custom-status-input" class="sr-only">
                  {t('userArea.customStatus')}
                </label>
                <div class="relative">
                  <i
                    class="fa-regular fa-face-smile pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    id="custom-status-input"
                    type="text"
                    placeholder={t('userArea.setCustomStatus')}
                    maxlength={128}
                    class={`${inputBaseClass} h-10 pl-9 pr-3`}
                    value={customStatusDraft()}
                    onInput={(e) => setCustomStatusDraft(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && setCustomStatus()}
                    onBlur={() => {
                      const draft = customStatusDraft().trim();
                      if (draft !== (p()?.custom_status ?? '')) setCustomStatus();
                    }}
                  />
                </div>
              </div>

              {/* Menu items */}
              <div class="border-t border-border/70 px-2 py-2">
                <button
                  type="button"
                  aria-expanded={statusMenuOpen()}
                  class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent/60"
                  onClick={() => setStatusMenuOpen((o) => !o)}
                >
                  <span class={`size-2.5 shrink-0 rounded-full ${currentStatusColor()}`} />
                  {statusLabel(p()?.status)}
                  <i
                    class={`fa-solid fa-chevron-right ml-auto text-xs text-muted-foreground transition-transform ${
                      statusMenuOpen() ? 'rotate-90' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                <Show when={statusMenuOpen()}>
                  <div class="my-1 space-y-0.5 rounded-xl bg-muted/25 p-1">
                    <For each={STATUS_OPTIONS}>
                      {(opt) => (
                        <button
                          type="button"
                          class={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent/60 disabled:opacity-50 ${
                            (p()?.status ?? 'offline') === opt.id ? 'bg-accent/40' : ''
                          }`}
                          onClick={() => setStatus(opt.id)}
                          disabled={saving()}
                        >
                          <span class={`size-2.5 shrink-0 rounded-full ${opt.color}`} />
                          {t(opt.labelKey)}
                          <Show when={(p()?.status ?? 'offline') === opt.id}>
                            <i class="fa-solid fa-check ml-auto text-xs text-primary" aria-hidden="true" />
                          </Show>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>

                <Show when={instance.instanceAdmin}>
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent/60"
                    onClick={() => {
                      setPopoverOpen(false);
                      navigate('/admin');
                    }}
                  >
                    <i class="fa-solid fa-shield-halved w-4 text-center text-muted-foreground" aria-hidden="true" />
                    {t('userArea.adminDashboard')}
                  </button>
                </Show>
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent/60"
                  onClick={copyUserId}
                >
                  <i class="fa-regular fa-id-card w-4 text-center text-muted-foreground" aria-hidden="true" />
                  {t('userArea.copyUserId')}
                </button>
              </div>

              {/* Edit Profile */}
              <div class="border-t border-border/70 p-3">
                <Button
                  class="w-full"
                  onClick={() => {
                    setPopoverOpen(false);
                    openUserSettings('account');
                  }}
                >
                  <i class="fa-solid fa-pen text-xs" aria-hidden="true" />
                  {t('userArea.editProfile')}
                </Button>
              </div>
            </div>
          </Portal>
        )}
      </Show>
    </>
  );
};
