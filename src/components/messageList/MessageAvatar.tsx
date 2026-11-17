import type { Component } from 'solid-js';
import { Show, createMemo, createSignal } from 'solid-js';
import { userDefaultAvatarUrl, type AvatarUser } from '../../lib/userAvatar';

interface MessageAvatarBase {
  name: string;
  avatar?: string | null;
  class?: string;
}

/**
 * A round avatar. It pictures either a person or a thing (a space, an application), and the
 * caller has to say which:
 *
 * - `user`: a person (bots included). With no avatar, or one that fails to load, it shows
 *   their default avatar (`lib/defaultAvatar.ts`). Pass whatever identifies them - the user
 *   object, or the id - even when it may be missing (an unknown sender still gets index 0).
 * - `initial`: a space or application, which keeps the first-letter fallback.
 */
export type MessageAvatarProps = MessageAvatarBase & ({ user: AvatarUser; initial?: never } | { initial: true; user?: never });

export const MessageAvatar: Component<MessageAvatarProps> = (props) => {
  // URLs that failed to load in this avatar. A broken custom avatar falls back to the default,
  // and a broken default (an instance whose web root does not serve it) to the letter.
  const [failed, setFailed] = createSignal<ReadonlySet<string>>(new Set());
  const src = createMemo(() => {
    const bad = failed();
    const own = props.avatar;
    if (own && !bad.has(own)) return own;
    if (props.initial) return undefined;
    const fallback = userDefaultAvatarUrl(props.user);
    return bad.has(fallback) ? undefined : fallback;
  });
  const onError = (e: Event & { currentTarget: HTMLImageElement }) => {
    const url = e.currentTarget.getAttribute('src');
    if (url) setFailed((prev) => new Set(prev).add(url));
  };

  return (
    <div
      class={`shrink-0 rounded-full flex items-center justify-center text-sm font-medium bg-primary/20 text-foreground ring-1 ring-border/50 overflow-hidden ${props.class ?? 'size-10'}`}
    >
      <Show when={src()} fallback={(props.name?.[0] ?? '?').toUpperCase()}>
        {(url) => <img src={url()} alt="" class="size-full rounded-full object-cover" onError={onError} />}
      </Show>
    </div>
  );
};
