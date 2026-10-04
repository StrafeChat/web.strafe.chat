import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { settings } from '../stores/settings';

/**
 * Placeholder rows drawn while a room's messages load. They are built with the same classes
 * as the real rows in MessageListView - the column's padding and 8px row gap, the row's
 * gutter and padding, the 40px avatar column, the 20px header line, the body's text-sm /
 * leading-relaxed line pitch, the group spacing, in cozy or compact mode - so every bar sits
 * exactly where the message that replaces it will, and nothing reflows when they arrive.
 * They vary the way a real conversation does: multi-message groups from one sender, short
 * one-liners, long paragraphs, an image, a reply, a row of reactions.
 */

type SkeletonKind = 'text' | 'long' | 'image' | 'reply' | 'reactions' | 'short';

interface SkeletonMessage {
  kind: SkeletonKind;
  /** Line widths as a percentage of the column, one per line. */
  lines: number[];
}

interface SkeletonGroup {
  /** Width of the name placeholder in px. */
  name: number;
  messages: SkeletonMessage[];
}

/**
 * A fixed script rather than Math.random(): the skeleton must look the same on every
 * render (a re-render mid-load would otherwise shuffle it), and a hand-picked sequence
 * reads more like a conversation than noise does.
 */
const SCRIPT: SkeletonGroup[] = [
  { name: 88, messages: [{ kind: 'text', lines: [58] }, { kind: 'short', lines: [24] }] },
  { name: 124, messages: [{ kind: 'long', lines: [96, 88, 41] }] },
  { name: 72, messages: [{ kind: 'image', lines: [34] }] },
  { name: 104, messages: [{ kind: 'reply', lines: [62] }, { kind: 'text', lines: [79, 30] }] },
  { name: 64, messages: [{ kind: 'reactions', lines: [47] }] },
  { name: 118, messages: [{ kind: 'text', lines: [71] }, { kind: 'text', lines: [52, 66] }, { kind: 'short', lines: [18] }] },
  { name: 96, messages: [{ kind: 'long', lines: [92, 84, 90, 37] }] },
  { name: 80, messages: [{ kind: 'text', lines: [44] }] },
  { name: 132, messages: [{ kind: 'image', lines: [52] }, { kind: 'short', lines: [27] }] },
  { name: 90, messages: [{ kind: 'reply', lines: [83, 29] }] },
  { name: 110, messages: [{ kind: 'text', lines: [64, 48] }, { kind: 'reactions', lines: [36] }] },
  { name: 76, messages: [{ kind: 'short', lines: [22] }] },
];

const pulse = 'animate-pulse rounded bg-muted';

/** One body line in cozy mode: the real body is text-sm with leading-relaxed, so the bar is
 * centred in a line box of exactly that height and consecutive lines keep the real pitch. */
const CozyLine: Component<{ width: number }> = (props) => (
  <div class="flex h-[1.625em] items-center text-sm">
    <div class={`h-3.5 ${pulse} bg-muted/80`} style={{ width: `${props.width}%` }} />
  </div>
);

/** One line in compact mode: text-sm at its default 20px line height. */
const CompactLine: Component<{ width: number }> = (props) => (
  <div class="flex h-5 items-center text-sm">
    <div class={`h-3.5 ${pulse} bg-muted/80`} style={{ width: `${props.width}%` }} />
  </div>
);

/** The extras a message kind adds under its text lines, at the real attachment/reaction offsets. */
const Extras: Component<{ kind: SkeletonKind }> = (props) => (
  <>
    <Show when={props.kind === 'image'}>
      <div class={`mt-1 h-44 w-full max-w-[320px] rounded-lg ${pulse} bg-muted/80`} />
    </Show>
    <Show when={props.kind === 'reactions'}>
      <div class="mt-1 flex gap-1">
        <div class={`h-6 w-11 rounded-full ${pulse} bg-muted/80`} />
        <div class={`h-6 w-11 rounded-full ${pulse} bg-muted/70`} />
        <div class={`h-6 w-14 rounded-full ${pulse} bg-muted/60`} />
      </div>
    </Show>
  </>
);

/** The "replying to …" line above a reply: 20px plus the 4px it keeps from the message, the
 * same 24px the real row pushes its avatar down by. */
const ReplyLine: Component = () => (
  <div class="mb-1 flex h-5 items-center gap-1.5">
    <div class={`size-4 rounded-full ${pulse} bg-muted/80`} />
    <div class={`h-3 w-16 ${pulse} bg-muted/80`} />
    <div class={`h-3 w-40 ${pulse} bg-muted/50`} />
  </div>
);

/**
 * The rows themselves, for the whole-room skeleton and the load-older placeholder alike.
 * `groups` is how many sender groups to draw; the script repeats past its end so a tall
 * viewport can be filled.
 */
export const MessageSkeletonRows: Component<{ groups?: number; class?: string }> = (props) => {
  const compact = () => !!settings.messageCompact;
  const script = () => {
    const n = props.groups ?? SCRIPT.length;
    return Array.from({ length: n }, (_, i) => SCRIPT[i % SCRIPT.length]);
  };
  // The same spacing rules as a real row: the column gaps rows by 8px; a group's header row
  // adds the configured group spacing (not the very first row); a follow-up row pulls itself
  // up to sit tight under the previous one.
  const rowClass = (gi: number, mi: number) =>
    `flex gap-3 -mx-2 px-2 py-0.5 ${
      mi === 0 ? (gi === 0 ? '' : 'mt-[var(--space-message-group)]') : compact() ? '-mt-0.5' : '-mt-1'
    }`;
  return (
    <div class={`flex flex-col gap-2 ${props.class ?? ''}`} aria-hidden="true">
      <For each={script()}>
        {(group, gi) => (
          <For each={group.messages}>
            {(m, mi) => (
              <div class={rowClass(gi(), mi())}>
                <Show when={!compact()}>
                  {/* The avatar column is always there (a follow-up row keeps the gutter). */}
                  <div class="flex w-10 shrink-0 flex-col items-center">
                    <Show when={mi() === 0}>
                      <div class={`size-10 shrink-0 rounded-full ${pulse} ${m.kind === 'reply' ? 'mt-6' : ''}`} />
                    </Show>
                  </div>
                </Show>
                <div class="min-w-0 flex-1">
                  <Show when={m.kind === 'reply'}>
                    <ReplyLine />
                  </Show>
                  <Show
                    when={!compact()}
                    fallback={
                      <div class="flex h-5 items-center gap-x-2 text-sm">
                        <div class={`h-3.5 shrink-0 ${pulse}`} style={{ width: `${group.name}px` }} />
                        <div class={`h-2.5 w-11 shrink-0 ${pulse} bg-muted/60`} />
                        <div class={`h-3.5 ${pulse} bg-muted/80`} style={{ width: `${m.lines[0]}%` }} />
                      </div>
                    }
                  >
                    <Show when={mi() === 0}>
                      <div class="mb-0.5 flex h-5 items-center gap-2 text-sm">
                        <div class={`h-3.5 ${pulse}`} style={{ width: `${group.name}px` }} />
                        <div class={`h-3 w-14 ${pulse} bg-muted/60`} />
                      </div>
                    </Show>
                    <CozyLine width={m.lines[0]} />
                  </Show>
                  <For each={m.lines.slice(1)}>
                    {(w) => (
                      <Show when={!compact()} fallback={<CompactLine width={w} />}>
                        <CozyLine width={w} />
                      </Show>
                    )}
                  </For>
                  <Extras kind={m.kind} />
                </div>
              </div>
            )}
          </For>
        )}
      </For>
    </div>
  );
};

/**
 * The whole-room skeleton. The same column as MessageList (its padding, bottom-anchored, clear
 * of the floating composer), so the rows stand where the messages will; it is anchored to the
 * bottom edge rather than laid out from the top, so a script taller than the viewport runs off
 * the top the way older history does, never under the composer.
 */
export const MessageSkeleton: Component = () => (
  <div class="relative flex-1 min-h-0">
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute inset-x-0 bottom-0 flex flex-col p-4 pb-[calc(var(--composer-height,0px)+0.25rem)]">
        <MessageSkeletonRows groups={SCRIPT.length * 2} />
      </div>
    </div>
  </div>
);
