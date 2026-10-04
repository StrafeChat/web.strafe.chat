import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { BotTag } from '../BotTag';

interface UserCellProps {
  name: string;
  /** Bot accounts get the BOT tag right after the name. */
  bot?: boolean;
  username?: string;
  avatar?: string;
  /** Extra line under the tag (e.g. "joined …"). */
  subline?: string;
  size?: 'sm' | 'md';
  class?: string;
}

/** Avatar + display name + @tag, the one shape used in every moderation table. */
export const UserCell: Component<UserCellProps> = (props) => (
  <div class={`flex min-w-0 items-center gap-2.5 ${props.class ?? ''}`}>
    <MessageAvatar name={props.name} avatar={props.avatar} class={props.size === 'sm' ? 'size-7 text-[11px]' : 'size-9 text-[13px]'} />
    <div class="min-w-0">
      <p class="flex min-w-0 items-center text-sm font-medium text-foreground">
        <span class="truncate">{props.name}</span>
        <BotTag bot={props.bot} size="xs" />
      </p>
      <Show when={props.username}>
        <p class="truncate text-xs text-muted-foreground">
          @{props.username}
          <Show when={props.subline}> · {props.subline}</Show>
        </p>
      </Show>
    </div>
  </div>
);
