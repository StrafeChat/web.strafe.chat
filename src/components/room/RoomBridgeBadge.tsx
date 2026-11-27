import type { Component } from 'solid-js';
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { BridgeSummary } from '../../api/bridges';
import { ensureAccountBridgeConsent, ensureSpaceBridgeConsent, myBridgeConsentIn, roomBridges, spaceBridgeConsentMode } from '../../stores/bridges';
import { openSpaceBridgeConsent } from '../../stores/bridgeConsentDialog';
import { requestOpenExternalLink } from '../../stores/externalLink';
import { bridgePlatformIcon, bridgePlatformLabel, BRIDGES_LEARN_MORE } from '../../lib/bridgePlatforms';
import { appSectionLabel, zLayer } from '../../theme/appChrome';
import { t } from '../../i18n';

const PANEL_WIDTH = 320;

/** The platforms a list of bridges reaches, named once each ("Discord, Matrix"). */
export function bridgedPlatformsLabel(list: BridgeSummary[]): string {
  const names: string[] = [];
  for (const b of list) {
    const n = bridgePlatformLabel(b.platform, b.platform_name);
    if (!names.includes(n)) names.push(n);
  }
  return names.join(', ');
}

/**
 * The room header's "Bridged: Discord" badge (spec 5.9): a room is never bridged silently.
 * Click: what the room is bridged with (as each bridge declares it), the bot that runs it,
 * whether it is running, what that means for privacy, whether the viewer's own messages are
 * copied, and a way to change that for this space.
 *
 * The panel is portaled like the header's other menus: the header's glass backdrop makes it
 * its own stacking context, so a panel nested in it would paint under the message list.
 */
export const RoomBridgeBadge: Component<{ spaceId: string | undefined; roomId: string | undefined }> = (props) => {
  const [open, setOpen] = createSignal(false);
  const [anchor, setAnchor] = createSignal<{ top: number; left: number } | null>(null);
  let rootEl: HTMLButtonElement | undefined;

  const list = createMemo(() => roomBridges(props.spaceId, props.roomId));
  const active = createMemo(() => list().filter((b) => b.state === 'active'));
  const label = createMemo(() => bridgedPlatformsLabel(active().length ? active() : list()));
  const consent = createMemo(() => myBridgeConsentIn(props.spaceId));
  const optIn = () => spaceBridgeConsentMode(props.spaceId) === 'optin';
  const badgeText = () => (active().length ? t('bridges.badge', { platforms: label() }) : t('bridges.badgePaused', { platforms: label() }));

  // What the viewer's own messages do is only worth a request once the room is bridged.
  createEffect(() => {
    if (!list().length || !props.spaceId) return;
    void ensureAccountBridgeConsent();
    void ensureSpaceBridgeConsent(props.spaceId);
  });

  function measure() {
    if (!rootEl) return;
    const r = rootEl.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - PANEL_WIDTH - 8));
    setAnchor({ top: r.bottom + 6, left });
  }

  createEffect(() => {
    if (!open()) return;
    measure();
    const onReflow = () => measure();
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (rootEl?.contains(target as Node)) return;
      if (target?.closest?.('[data-bridge-panel]')) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    onCleanup(() => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    });
  });

  // Leaving the room (or the bridge going away) closes the panel.
  createEffect(() => {
    if (!list().length) setOpen(false);
  });

  const stateText = (b: BridgeSummary) => {
    if (b.state === 'active') return '';
    const reason = b.state_reason ?? '';
    const known = ['paused_by_manager', 'paused_by_driver', 'became_private', 'driver_lost_permission', 'encrypted'];
    return known.includes(reason) ? t(`bridges.state.reason.${reason}`) : t(`bridges.state.${b.state === 'disabled' ? 'disabled' : 'paused'}`);
  };

  return (
    <Show when={list().length > 0}>
      <button
        ref={(el) => (rootEl = el)}
        type="button"
        class={`flex h-6 min-w-0 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium ring-1 ring-inset transition-colors lg:px-2 ${
          active().length
            ? 'bg-sky-500/10 text-sky-600 ring-sky-500/25 hover:bg-sky-500/15 dark:text-sky-400'
            : 'bg-muted text-muted-foreground ring-border hover:bg-muted/80'
        }`}
        aria-expanded={open()}
        aria-haspopup="dialog"
        // Below lg the header has no room for the words: the glyph stays, named for
        // screen readers and on hover.
        aria-label={badgeText()}
        data-tooltip={badgeText()}
        data-bridge-badge
        onClick={() => setOpen((v) => !v)}
      >
        <i class="fa-solid fa-bridge text-[10px]" aria-hidden="true" />
        <span class="hidden max-w-[12rem] truncate lg:inline">{badgeText()}</span>
      </button>
      <Show when={open() && anchor()}>
        <Portal>
          <div
            data-bridge-panel
            role="dialog"
            aria-label={t('bridges.panel.title')}
            class={`fixed ${zLayer.popover} max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-popover/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl`}
            style={{ top: `${anchor()!.top}px`, left: `${anchor()!.left}px`, width: `${PANEL_WIDTH}px`, 'max-width': 'calc(100vw - 16px)' }}
          >
            <p class="text-sm font-semibold text-foreground">{t('bridges.panel.title')}</p>
            <div class="mt-3 space-y-3">
              <For each={list()}>
                {(b) => (
                  <div class="rounded-xl border border-border/60 bg-card/20 p-3" data-bridge-summary={b.id}>
                    <div class="flex items-center gap-2">
                      <i class={`${bridgePlatformIcon(b.platform)} text-sm text-muted-foreground`} aria-hidden="true" />
                      <span class="min-w-0 truncate text-sm font-semibold text-foreground">{bridgePlatformLabel(b.platform, b.platform_name)}</span>
                      <Show when={b.state !== 'active'}>
                        <span class="ms-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {b.state === 'disabled' ? t('bridges.state.disabled') : t('bridges.state.paused')}
                        </span>
                      </Show>
                    </div>
                    <Show when={b.remote?.name}>
                      {(remote) => (
                        <p class="mt-1.5 text-xs text-muted-foreground">
                          {t('bridges.panel.remote')}{' '}
                          <Show when={b.remote?.url} fallback={<span class="font-medium text-foreground">{remote()}</span>}>
                            {(url) => (
                              <button
                                type="button"
                                class="font-medium text-primary hover:underline"
                                onClick={() => {
                                  setOpen(false);
                                  requestOpenExternalLink(url());
                                }}
                              >
                                {remote()}
                              </button>
                            )}
                          </Show>
                          <span class="block text-[11px] text-muted-foreground/80">{t('bridges.panel.selfDeclared')}</span>
                        </p>
                      )}
                    </Show>
                    <p class="mt-1.5 text-xs text-muted-foreground">
                      {b.driver_name ? t('bridges.panel.runBy', { bot: b.driver_name }) : t('bridges.panel.runByBot')}
                      <Show when={b.name}>
                        <span> · {b.name}</span>
                      </Show>
                    </p>
                    <Show when={stateText(b)}>
                      <p class="mt-1 text-xs text-amber-600 dark:text-amber-400">{stateText(b)}</p>
                    </Show>
                  </div>
                )}
              </For>
            </div>
            <div class="mt-3 space-y-2 border-t border-border/60 pt-3">
              <p class={appSectionLabel}>{t('bridges.panel.privacyTitle')}</p>
              <p class="text-xs leading-snug text-muted-foreground">
                {t('bridges.panel.privacyBody', { platforms: label() })}{' '}
                {optIn() ? t('bridges.panel.modeOptIn') : t('bridges.panel.modeOptOut')}
              </p>
              <div class="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2.5 py-2">
                <p class="min-w-0 text-xs text-foreground" data-bridge-consent-state={consent()}>
                  <i
                    class={`fa-solid ${consent() === 'allow' ? 'fa-share-from-square text-sky-500' : 'fa-eye-slash text-muted-foreground'} me-1.5`}
                    aria-hidden="true"
                  />
                  {consent() === 'allow' ? t('bridges.panel.yoursCopied') : t('bridges.panel.yoursNotCopied')}
                </p>
                <Show when={props.spaceId}>
                  {(sid) => (
                    <button
                      type="button"
                      class="shrink-0 text-xs font-semibold text-primary hover:underline"
                      onClick={() => {
                        setOpen(false);
                        openSpaceBridgeConsent(sid());
                      }}
                    >
                      {t('bridges.panel.change')}
                    </button>
                  )}
                </Show>
              </div>
              <a href={BRIDGES_LEARN_MORE} target="_blank" rel="noopener" class="inline-block text-xs font-medium text-primary hover:underline">
                {t('bridges.learnMore')}
              </a>
            </div>
          </div>
        </Portal>
      </Show>
    </Show>
  );
};
