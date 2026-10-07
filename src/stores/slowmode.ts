import { createSignal } from 'solid-js';
import { createStore, produce } from 'solid-js/store';

/**
 * Per-channel slowmode cooldowns, the way Discord shows them: after you send in a channel
 * with slowmode on, a countdown runs in the composer and sending waits for it.
 *
 * The server is the authority (messages/service.go enforces the window in Redis and answers
 * a too-soon send with 429 + `retry_after`); this is the local mirror of it, so the person
 * sees the wait instead of a refusal. It is keyed by room id rather than held in the
 * composer so switching channels and coming back keeps the countdown running, and a
 * refusal from the server can correct it (`startSlowmode` with the server's retry_after).
 */
const [until, setUntil] = createStore<Record<string, number>>({});
/** Ticks while any cooldown is pending; read by slowmodeRemaining to re-render the number. */
const [now, setNow] = createSignal(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

/** Faster than a second so the number never looks stuck on its way down. */
const TICK_MS = 250;

function ensureTicker(): void {
  if (timer !== undefined) return;
  timer = setInterval(() => {
    const t = Date.now();
    setNow(t);
    // Nothing left to count down: stop, rather than tick forever in the background.
    if (!Object.values(until).some((end) => end > t)) {
      clearInterval(timer);
      timer = undefined;
    }
  }, TICK_MS);
}

/** Start (or extend) a room's cooldown. Ignores a zero/negative wait. */
export function startSlowmode(roomId: string | undefined, seconds: number): void {
  if (!roomId || !Number.isFinite(seconds) || seconds <= 0) return;
  const end = Date.now() + seconds * 1000;
  // Never shorten a running cooldown: the server's answer may be stricter than our guess.
  if ((until[roomId] ?? 0) >= end) return;
  setUntil(roomId, end);
  setNow(Date.now());
  ensureTicker();
}

/** Whole seconds left on a room's cooldown, 0 when it may send. Reactive. */
export function slowmodeRemaining(roomId: string | undefined): number {
  if (!roomId) return 0;
  const end = until[roomId];
  if (!end) return 0;
  const ms = end - now();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}

/** Drop a room's cooldown (slowmode turned off, or the viewer became exempt). */
export function clearSlowmode(roomId: string): void {
  setUntil(
    produce((s) => {
      delete s[roomId];
    })
  );
}
