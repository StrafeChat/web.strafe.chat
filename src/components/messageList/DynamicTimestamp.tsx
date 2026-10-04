import type { Component } from 'solid-js';
import { createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import {
  formatRelativeTimestamp,
  formatTimestamp,
  formatTimestampTooltip,
  type TimestampStyle,
} from '../../lib/utils/messageTimestamp';

/** How often a live ("R") timestamp re-reads the clock. Ten seconds is what makes it feel live
 *  without repainting: fast enough that "5 minutes ago" doesn't sit there lying, slow enough
 *  that a busy room doesn't churn. */
const REFRESH_MS = 10_000;

/**
 * One clock shared by every live timestamp on screen.
 *
 * A busy room can hold hundreds of `<t:…:R>` tokens; if each owned a timer they'd all fire
 * independently and re-render the whole message list every ten seconds. The interval is
 * therefore module-level and reference-counted: it exists only while at least one live
 * timestamp is mounted, and stops entirely once they are all scrolled out of the tree.
 */
const [now, setNow] = createSignal(Date.now());
let live = 0;
let timer: ReturnType<typeof setInterval> | undefined;

/**
 * A `<t:unixSeconds[:style]>` from message content, shown in the reader's own timezone, clock
 * and language - the token carries an instant, so the sender's locale never leaks into it.
 *
 * Hovering (or the app-wide tooltip host, which adopts `title`) reveals the full weekday +
 * date + time, so a bare "5:00 PM" is never ambiguous about which day it means.
 */
export const DynamicTimestamp: Component<{ unix: number; style: TimestampStyle }> = (props) => {
  onMount(() => {
    live += 1;
    if (timer === undefined) {
      timer = setInterval(() => setNow(Date.now()), REFRESH_MS);
    }
    // Another clock may have gone stale while nothing was listening.
    setNow(Date.now());
    onCleanup(() => {
      live -= 1;
      if (live <= 0 && timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    });
  });

  const date = createMemo(() => new Date(props.unix * 1000));
  const label = createMemo(() =>
    props.style === 'R'
      ? formatRelativeTimestamp(date(), new Date(now()))
      : formatTimestamp(date(), props.style)
  );
  const tooltip = createMemo(() => formatTimestampTooltip(date()));

  return (
    <span class="cursor-help rounded bg-muted px-1 text-muted-foreground" title={tooltip()}>
      {label()}
    </span>
  );
};