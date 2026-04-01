import type { Component } from 'solid-js';
import { For } from 'solid-js';
import { parseMessageContent } from '../../lib/utils/markdown';
import { isExternalLink, requestOpenExternalLink } from '../../stores/externalLink';
import type { RoomParticipant } from '../../api/rooms';

export interface MessageBodyProps {
  text: string;
  class?: string;
  /** Used to resolve <@userId> mentions to display names */
  participants?: RoomParticipant[];
}

export const MessageBody: Component<MessageBodyProps> = (props) => {
  const segments = () => parseMessageContent(props.text);

  return (
    <div class={props.class}>
      <For each={segments()}>
        {(seg) => {
          if (seg.type === 'text') {
            return <span class="whitespace-pre-wrap">{seg.content}</span>;
          }
          if (seg.type === 'bold') {
            return <strong class="font-semibold">{seg.content}</strong>;
          }
          if (seg.type === 'italic') {
            return <em class="italic">{seg.content}</em>;
          }
          if (seg.type === 'code') {
            return (
              <code class="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
                {seg.content}
              </code>
            );
          }
          if (seg.type === 'codeBlock') {
            return (
              <div class="my-1.5 block rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-[0.85em] whitespace-pre-wrap overflow-x-auto">
                {seg.content}
              </div>
            );
          }
          if (seg.type === 'link') {
            const href = seg.href;
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary underline underline-offset-2 break-all hover:text-primary/90 cursor-pointer"
                onClick={(e) => {
                  if (!isExternalLink(href)) return;
                  if (e.shiftKey) return; // Shift+click: bypass modal, open directly
                  e.preventDefault();
                  requestOpenExternalLink(href);
                }}
              >
                {seg.text}
              </a>
            );
          }
          if (seg.type === 'mention') {
            let display: string;
            if ('userId' in seg && seg.userId && props.participants?.length) {
              const p = props.participants.find((x) => x.id === seg.userId);
              display = p?.display_name || p?.username || 'Unknown';
            } else if ('username' in seg && seg.username && props.participants?.length) {
              const name = seg.username;
              const p = props.participants.find(
                (x) =>
                  (x.display_name && x.display_name.toLowerCase() === name.toLowerCase()) ||
                  (x.username && x.username.toLowerCase() === name.toLowerCase())
              );
              display = p ? (p.display_name || p.username || name) : name;
            } else {
              display = 'username' in seg ? seg.username : 'Unknown';
            }
            return (
              <span class="rounded bg-primary/20 px-1 py-0.5 font-medium text-primary">
                @{display}
              </span>
            );
          }
          return null;
        }}
      </For>
    </div>
  );
};
