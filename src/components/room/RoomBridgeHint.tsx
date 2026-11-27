import type { Component } from 'solid-js';
import { Show, createEffect, createMemo, createSignal } from 'solid-js';
import { activeRoomBridges, ensureAccountBridgeConsent, ensureSpaceBridgeConsent, myBridgeConsentIn } from '../../stores/bridges';
import { openSpaceBridgeConsent } from '../../stores/bridgeConsentDialog';
import { bridgedPlatformsLabel } from './RoomBridgeBadge';
import { t } from '../../i18n';

const STORAGE_KEY = 'strafe_bridge_hints_seen';
const MAX_KEPT = 200;

/** Rooms (with the set of bridges they had) whose hint this browser has already shown and the
 * person has posted past or closed. A new bridge in the same room shows it again. */
function loadSeen(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const [seen, setSeen] = createSignal<string[]>(loadSeen());

function hintKey(spaceId: string | undefined, roomId: string | undefined): string | null {
  if (!roomId) return null;
  const ids = activeRoomBridges(spaceId, roomId)
    .map((b) => b.id)
    .sort();
  return ids.length ? `${roomId}:${ids.join(',')}` : null;
}

function remember(key: string): void {
  if (seen().includes(key)) return;
  const next = [...seen().filter((k) => k !== key), key].slice(-MAX_KEPT);
  setSeen(next);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage refused (private window, quota): the hint just shows again next time */
  }
}

/** The person posted in this room: the hint has done its job (spec 5.9: "the first time
 * someone posts in a bridged room"). */
export function markBridgeHintSeen(spaceId: string | undefined, roomId: string | undefined): void {
  const key = hintKey(spaceId, roomId);
  if (key) remember(key);
}

/**
 * The one-line hint over the composer of a bridged room, until the person has posted there
 * once (or closed it): this room is copied to Discord, and whether *their* messages are -
 * which is their own privacy setting, one click away. A room is never bridged silently.
 */
export const RoomBridgeHint: Component<{ spaceId: string | undefined; roomId: string | undefined }> = (props) => {
  const active = createMemo(() => activeRoomBridges(props.spaceId, props.roomId));
  const key = createMemo(() => hintKey(props.spaceId, props.roomId));
  const show = () => {
    const k = key();
    return !!k && !seen().includes(k);
  };
  const consent = createMemo(() => myBridgeConsentIn(props.spaceId));
  const platforms = createMemo(() => bridgedPlatformsLabel(active()));

  createEffect(() => {
    if (!show() || !props.spaceId) return;
    void ensureAccountBridgeConsent();
    void ensureSpaceBridgeConsent(props.spaceId);
  });

  return (
    <Show when={show()}>
      <div class="flex items-center gap-2 px-3 pb-1.5 pt-0.5 text-xs text-muted-foreground" role="note" data-bridge-hint={consent()}>
        <i class="fa-solid fa-bridge shrink-0 text-[11px] text-sky-500" aria-hidden="true" />
        <p class="min-w-0 flex-1 leading-snug">
          {consent() === 'allow'
            ? t('bridges.hint.copied', { platforms: platforms() })
            : t('bridges.hint.notCopied', { platforms: platforms() })}
        </p>
        <Show when={props.spaceId}>
          {(sid) => (
            <button
              type="button"
              class="shrink-0 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              onClick={() => openSpaceBridgeConsent(sid())}
            >
              {t('bridges.hint.change')}
            </button>
          )}
        </Show>
        <button
          type="button"
          class="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t('bridges.hint.dismiss')}
          data-tooltip={t('bridges.hint.dismiss')}
          onClick={() => {
            const k = key();
            if (k) remember(k);
          }}
        >
          <i class="fa-solid fa-xmark text-[11px]" aria-hidden="true" />
        </button>
      </div>
    </Show>
  );
};
