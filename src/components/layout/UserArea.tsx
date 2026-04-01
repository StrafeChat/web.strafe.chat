import type { Component } from 'solid-js';
import { createSignal, Show, For, onCleanup, onMount, createEffect } from 'solid-js';
import { Portal } from 'solid-js/web';
import { auth } from '../../stores/auth';
import { presence, setUserPresence, type UserPresence } from '../../stores/presence';
import { PresenceDot } from '../PresenceDot';
import { patchMe } from '../../api/users';
import { openUserSettings } from '../../stores/userSettingsModal';
import { appMenuPopover, appUserDock } from '../../theme/appChrome';

const STATUS_OPTIONS: { id: UserPresence['status']; label: string; color: string }[] = [
  { id: 'online', label: 'Online', color: 'bg-green-500' },
  { id: 'idle', label: 'Idle', color: 'bg-yellow-500' },
  { id: 'dnd', label: 'Do Not Disturb', color: 'bg-red-500' },
  { id: 'invisible', label: 'Invisible', color: 'bg-muted-foreground/50' },
];

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  invisible: 'Invisible',
  offline: 'Invisible',
};

function formatDiscriminator(d: number): string {
  return String(d).padStart(4, '0');
}

export const UserArea: Component = () => {
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
    const status = pres?.status ?? 'offline';
    return STATUS_LABELS[status] ?? 'Offline';
  };

  const subtitleText = () =>
    isHovering() ? `${username()}#${discriminatorStr()}` : statusText();

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
      status: current?.status ?? 'offline',
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

  onMount(() => {
    document.addEventListener('click', handleDocumentClick);
    onCleanup(() => document.removeEventListener('click', handleDocumentClick));
  });

  return (
    <>
    <div
      ref={(el) => { areaEl = el; }}
      class={`relative flex items-center gap-1 px-2 py-2.5 ${appUserDock}`}
    >
      <div
        id="user-area-trigger"
        role="button"
        tabIndex={0}
        class="flex items-center gap-2 flex-1 min-w-0 rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={() => setPopoverOpen((o) => !o)}
        onKeyDown={(e) => e.key === 'Enter' && setPopoverOpen((o) => !o)}
      >
        <div class="relative shrink-0 p-0.5">
          <div class="size-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
            {displayName()[0]?.toUpperCase() ?? '?'}
          </div>
          <span class="absolute bottom-[.5px] right-[.5px]">
            <PresenceDot userId={userId()} class="size-3.25" />
          </span>
        </div>
        <div class="flex-1 min-w-0 text-left">
          <div class="text-xs font-medium text-foreground truncate">{displayName()}</div>
          <div class="text-[11px] text-muted-foreground truncate leading-tight">
            {subtitleText()}
          </div>
        </div>
      </div>
      <button
        type="button"
        class="size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
        title="Settings"
        aria-label="Settings"
        onClick={() => {
          setPopoverOpen(false);
          openUserSettings();
        }}
      >
        <i class="fa-solid fa-gear text-xs" />
      </button>
    </div>

      <Show when={popoverOpen() && popoverPos()}>
        {(pos) => (
        <Portal>
        <div
          id="user-popover"
          data-modal
          class={`fixed z-50 max-h-[85vh] w-[300px] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${appMenuPopover}`}
          style={{
            left: `${pos().left}px`,
            bottom: `${pos().bottom}px`,
          }}
        >
          {/* Banner */}
          <div class="h-14 rounded-t-xl bg-primary/30" />

          {/* Avatar + name */}
          <div class="px-5 -mt-10 pb-4">
            <div class="relative inline-block">
              <div class="size-20 rounded-full border-4 border-card bg-primary flex items-center justify-center text-2xl font-semibold text-primary-foreground">
                {displayName()[0]?.toUpperCase() ?? '?'}
              </div>
              <span class="absolute bottom-1 right-1">
                <PresenceDot userId={userId()} class="size-5" />
              </span>
            </div>
            <h3 class="mt-3 text-lg font-semibold text-foreground">{displayName()}</h3>
            <button
              type="button"
              onClick={copyDiscriminator}
              class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-0.5"
            >
              {username()}#{discriminatorStr()}
              <i class="fa-regular fa-copy text-[10px]" />
            </button>
          </div>

          {/* Set custom status */}
          <div class="px-5 pb-4">
            <button
              type="button"
              onClick={() => document.getElementById('custom-status-input')?.focus()}
              class="flex items-center gap-2 w-full text-left text-sm text-muted-foreground hover:text-foreground rounded py-1.5"
            >
              <i class="fa-regular fa-face-smile" />
              {p()?.custom_status ? (
                <span class="truncate">{p()!.custom_status}</span>
              ) : (
                <span>Set a custom status</span>
              )}
            </button>
            <input
              id="custom-status-input"
              type="text"
              placeholder="Set a custom status"
              maxlength={128}
              class="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={customStatusDraft()}
              onInput={(e) => setCustomStatusDraft(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && setCustomStatus()}
              onBlur={() => {
                const draft = customStatusDraft().trim();
                if (draft !== (p()?.custom_status ?? '')) setCustomStatus();
              }}
            />
          </div>

          {/* Menu items */}
          <div class="border-t border-border py-2">
            <button
              type="button"
              class="relative flex items-center gap-3 w-full px-5 py-3 text-sm text-foreground hover:bg-accent/50 transition-colors"
              onClick={() => setStatusMenuOpen((o) => !o)}
            >
              <span
                class={`size-2.5 rounded-full shrink-0 ${
                  STATUS_OPTIONS.find((s) => s.id === (p()?.status ?? 'offline'))?.color ?? 'bg-muted-foreground/50'
                }`}
              />
              {STATUS_LABELS[p()?.status ?? 'offline'] ?? 'Offline'}
              <i class="fa-solid fa-chevron-right ml-auto text-xs text-muted-foreground" />
            </button>

            <Show when={statusMenuOpen()}>
              <div class="border-y border-border bg-card/40 px-5 py-3 backdrop-blur-sm">
                <For each={STATUS_OPTIONS}>
                  {(opt) => (
                    <button
                      type="button"
                      class="flex items-center gap-3 w-full py-2.5 text-sm text-foreground hover:bg-accent/50 rounded px-3 -mx-3 transition-colors"
                      onClick={() => setStatus(opt.id)}
                      disabled={saving()}
                    >
                      <span class={`size-2.5 rounded-full shrink-0 ${opt.color}`} />
                      {opt.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <button
              type="button"
              class="flex items-center gap-3 w-full px-5 py-3 text-sm text-foreground hover:bg-accent/50 transition-colors"
              onClick={copyUserId}
            >
              <i class="fa-regular fa-id-card text-muted-foreground w-4" />
              Copy User ID
            </button>
          </div>

          {/* Edit Profile */}
          <div class="p-4 border-t border-border">
            <button
              type="button"
              class="flex items-center justify-center gap-2.5 w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              <i class="fa-solid fa-pen" />
              Edit Profile
            </button>
          </div>
        </div>
        </Portal>
        )}
      </Show>
    </>
  );
};
