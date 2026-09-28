import type { Component } from 'solid-js';
import { Show, createSignal, createEffect, onCleanup } from 'solid-js';
import { stargate } from '../stores/stargate';
import { t } from '../i18n';

/**
 * A small top-centre pill shown whenever the realtime gateway is not connected, so a
 * dropped or reconnecting socket is visible to the user instead of silently leaving the
 * UI stale. Hidden on the normal sub-second connect via a short debounce.
 */
export const ConnectionStatusBanner: Component = () => {
  const [visible, setVisible] = createSignal(false);
  createEffect(() => {
    const st = stargate.status;
    const down = st === 'connecting' || st === 'reconnecting' || st === 'failed' || st === 'disconnected';
    if (!down) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 1000);
    onCleanup(() => clearTimeout(timer));
  });

  return (
    <Show when={visible()}>
      <div class="pointer-events-none fixed inset-x-0 top-0 z-[350] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div
          role="status"
          class="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/95 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-lg shadow-black/20 backdrop-blur-md"
        >
          <i class="fa-solid fa-arrows-rotate animate-spin text-[11px] text-amber-500" aria-hidden="true" />
          {t('connection.reconnecting')}
        </div>
      </div>
    </Show>
  );
};
