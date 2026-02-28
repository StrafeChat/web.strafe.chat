import type { Component } from 'solid-js';

export interface MessageAvatarProps {
  name: string;
  avatar?: string;
  class?: string;
}

export const MessageAvatar: Component<MessageAvatarProps> = (props) => (
  <div
    class={`shrink-0 rounded-full flex items-center justify-center text-sm font-medium bg-primary/20 text-foreground ${props.class ?? 'size-10'}`}
  >
    {props.avatar ? (
      <img src={props.avatar} alt="" class="size-full rounded-full object-cover" />
    ) : (
      (props.name?.[0] ?? '?').toUpperCase()
    )}
  </div>
);
