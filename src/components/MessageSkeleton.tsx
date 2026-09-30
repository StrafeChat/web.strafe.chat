import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { settings } from '../stores/settings';

/**
 * Placeholder rows drawn while a room's messages load. They use the real message layout
 * (the same avatar size, gutter, group spacing and line heights as MessageList, in cozy or
 * compact mode) so the page doesn't reflow when the messages arrive, and they vary the way
 * a real conversation does: multi-message groups from one sender, short one-liners, long
 * paragraphs, an image, a reply, a row of reactions.
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

const Lines: Component<{ lines: number[]; leading?: boolean }> = (props) => (
  <For each={props.lines}>
    {(w, i) => <div class={`h-4 ${pulse} ${i() === 0 && props.leading === false ? '' : 'mt-1.5'}`} style={{ width: `${w}%` }} />}
  </For>
);

/** The extras a message kind adds under its text lines. */
const Extras: Component<{ kind: SkeletonKind }> = (props) => (
  <>
    <Show when={props.kind === 'image'}>
      <div class={`mb-2 mt-2 h-44 w-full max-w-[320px] rounded-lg ${pulse} bg-muted/80`} />
    </Show>
    <Show when={props.kind === 'reactions'}>
      <div class="mt-2 flex gap-1.5">
        <div class={`h-6 w-11 rounded-full ${pulse} bg-muted/80`} />
        <div class={`h-6 w-11 rounded-full ${pulse} bg-muted/70`} />
        <div class={`h-6 w-14 rounded-full ${pulse} bg-muted/60`} />
      </div>
    </Show>
  </>
);

/** The "replying to …" line above a reply. */
const ReplyLine: Component = () => (
  <div class="mb-1 flex h-5 items-center gap-1.5">
    <div class={`size-4 rounded-full ${pulse} bg-muted/80`} />
    <div class={`h-3 w-16 ${pulse} bg-muted/80`} />
    <div class={`h-3 w-40 ${pulse} bg-muted/50`} />
  </div>
);

/**
 * The rows themselves, for the empty-room skeleton and the load-older placeholder alike.
 * `groups` caps how many sender groups are drawn (from the top of the script).
 */
export const MessageSkeletonRows: Component<{ groups?: number; class?: string }> = (props) => {
  const compact = () => !!settings.messageCompact;
  const script = () => SCRIPT.slice(0, props.groups ?? SCRIPT.length);
  return (
    <div class={`flex flex-col ${props.class ?? ''}`} aria-hidden="true">
      <For each={script()}>
        {(group, gi) => (
          <div class={gi() === 0 ? '' : 'mt-[var(--space-message-group)]'}>
            <For each={group.messages}>
              {(m, mi) => (
                <Show
                  when={!compact()}
                  fallback={
                    <div class="-mx-2 flex items-start gap-x-2 px-2 py-0.5">
                      <div class={`mt-1 h-3 w-12 shrink-0 ${pulse} bg-muted/60`} />
                      <div class="min-w-0 flex-1">
                        <Show when={m.kind === 'reply'}>
                          <ReplyLine />
                        </Show>
                        <div class="flex items-center gap-2">
                          <Show when={mi() === 0}>
                            <div class={`h-4 shrink-0 ${pulse}`} style={{ width: `${group.name}px` }} />
                          </Show>
                          <div class={`h-4 ${pulse} bg-muted/80`} style={{ width: `${m.lines[0]}%` }} />
                        </div>
                        <Lines lines={m.lines.slice(1)} />
                        <Extras kind={m.kind} />
                      </div>
                    </div>
                  }
                >
                  <div class={`-mx-2 flex gap-3 px-2 py-0.5 ${mi() === 0 ? '' : '-mt-1'}`}>
                    <Show when={mi() === 0} fallback={<div class="size-10 shrink-0" />}>
                      <div class={`size-10 shrink-0 rounded-full ${pulse}`} />
                    </Show>
                    <div class="min-w-0 flex-1">
                      <Show when={m.kind === 'reply'}>
                        <ReplyLine />
                      </Show>
                      <Show when={mi() === 0}>
                        <div class="mb-1 flex items-center gap-2">
                          <div class={`h-4 ${pulse}`} style={{ width: `${group.name}px` }} />
                          <div class={`h-3 w-14 ${pulse} bg-muted/60`} />
                        </div>
                      </Show>
                      <div class={`h-4 ${pulse} bg-muted/80`} style={{ width: `${m.lines[0]}%` }} />
                      <Lines lines={m.lines.slice(1)} />
                      <Extras kind={m.kind} />
                    </div>
                  </div>
                </Show>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  );
};

/** The whole-room skeleton: fills the message column from the bottom, like messages do. */
export const MessageSkeleton: Component = () => (
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="flex min-h-full flex-col justify-end px-4 pb-4 pt-6">
      <MessageSkeletonRows />
    </div>
  </div>
);
