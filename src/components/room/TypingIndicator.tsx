import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { t } from '../../i18n';

export interface TypingPerson {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface TypingIndicatorProps {
  /** Who is typing, oldest first. Empty renders nothing, but the row keeps its height so
   * the composer doesn't jump every time someone starts or stops. */
  people: TypingPerson[];
}

/** Beyond this the row reads "several people" rather than listing names, like Discord. */
const MAX_NAMED = 3;
/** Faces shown before the stack turns into a "+N" chip. */
const MAX_FACES = 3;

function message(people: TypingPerson[]): string {
  const names = people.map((p) => p.name);
  if (names.length === 1) return t('room.typingOne', { name: names[0] });
  if (names.length === 2) return t('room.typingPair', { a: names[0], b: names[1] });
  if (names.length === 3) return t('room.typingTrio', { a: names[0], b: names[1], c: names[2] });
  return t('room.typingMany');
}

/**
 * The row under the composer: the faces of everyone currently typing, overlapping into one
 * stack, then the animated dots and the usual "X is typing…" line.
 *
 * Each face is explicitly stacked (`relative` + a descending z-index) rather than left to
 * paint order, so the first person - the one the sentence names first - sits on top and the
 * rest tuck underneath. `isolate` keeps those z-indexes from competing with anything else
 * on the page, and the ring in the page background colour is what cuts the notch that makes
 * the avatars look clipped into each other.
 */
export const TypingIndicator: Component<TypingIndicatorProps> = (props) => {
  const faces = () => props.people.slice(0, MAX_FACES);
  const overflow = () => Math.max(0, props.people.length - MAX_FACES);

  return (
    <div class="flex h-6 shrink-0 items-center px-5">
      <Show when={props.people.length > 0}>
        <p class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
          <span class="isolate flex shrink-0 items-center" aria-hidden="true">
            <For each={faces()}>
              {(person, i) => (
                // The ring lives on a wrapper, not on MessageAvatar: the avatar already
                // sets `ring-1 ring-border/50`, and two ring utilities on one element
                // resolve by stylesheet order, not by the order they're written in.
                <span
                  class={`relative rounded-full ring-2 ring-background ${i() > 0 ? '-ms-1.5' : ''}`}
                  style={{ 'z-index': MAX_FACES + 1 - i() }}
                >
                  <MessageAvatar name={person.name} avatar={person.avatar ?? undefined} class="size-4.5 text-[8px]" />
                </span>
              )}
            </For>
            <Show when={overflow() > 0}>
              <span
                class="relative -ms-1.5 flex size-4.5 items-center justify-center rounded-full bg-muted text-[8px] font-semibold text-muted-foreground ring-2 ring-background"
                style={{ 'z-index': 1 }}
              >
                +{overflow()}
              </span>
            </Show>
          </span>
          <span class="inline-flex shrink-0 gap-0.5" aria-hidden="true">
            <span class="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
            <span class="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
            <span class="size-1 animate-bounce rounded-full bg-muted-foreground" />
          </span>
          <span class="truncate">{message(props.people.slice(0, MAX_NAMED + 1))}</span>
        </p>
      </Show>
    </div>
  );
};
