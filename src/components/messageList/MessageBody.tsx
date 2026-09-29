import type { Component } from 'solid-js';
import { For, Show, createMemo } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { parseMessageContent } from '../../lib/utils/markdown';
import { Emoji } from '../emoji/Emoji';
import { CustomEmoji } from '../emoji/CustomEmoji';
import { extractSpaceInviteCodeFromUrl } from '../../lib/utils/spaceInviteLink';
import { SpaceInviteLinkEmbed } from '../SpaceInviteLinkEmbed';
import { LinkPreview } from './LinkPreview';
import { isGifUrl } from '../../lib/gif/providers';
import { isExternalLink, requestOpenExternalLink } from '../../stores/externalLink';
import { spaces } from '../../stores/spaces';
import type { RoomParticipant } from '../../api/rooms';
import type { SpaceRole } from '../../api/spaces';
import { spaceRoleColorHex } from '../../lib/spacePermissions';
import { t } from '../../i18n';

export interface MessageBodyProps {
  text: string;
  class?: string;
  /** Used to resolve <@userId> mentions to display names */
  participants?: RoomParticipant[];
  /** Used to resolve <@&roleId> mentions to role names/colors. Only relevant in space text channels. */
  spaceRoles?: SpaceRole[];
  /** When provided, user mentions become clickable (opens that user's profile card). */
  onMentionClick?: (userId: string, anchor: HTMLElement) => void;
  /** Rendered inline at the very end of the content, so an "(edited)" marker sits on the last
   * line of text instead of dropping to its own line (Discord-style). */
  trailing?: import('solid-js').JSX.Element;
  /** Render link-preview cards under the text for the http(s) URLs in this message. The caller
   * decides (non-encrypted room, or the per-user opt-in for encrypted ones). */
  allowLinkPreviews?: boolean;
}

const pillBase = 'rounded px-1 py-0.5 font-medium';
const brandPill = `${pillBase} bg-primary/20 text-primary`;
const brandPillClickable = `${brandPill} cursor-pointer transition-colors hover:bg-primary/35 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;

/** Find a space text channel by id across every space the user is in. */
function findChannel(roomId: string): { spaceId: string; name: string } | null {
  for (const [spaceId, list] of Object.entries(spaces.spaceRoomsBySpaceId)) {
    const r = list.find((x) => x.id === roomId);
    if (r) return { spaceId, name: r.name || 'unnamed' };
  }
  return null;
}

/** Discord-style "jumbo" emoji: a message that is nothing but a few emoji renders them big. */
const JUMBO_MAX = 10;

/** Inline GIF (or a bare .gif/.webp link): the animation itself, capped and lazy-loaded, with
 * the source link behind a click (guarded like every other external link). */
const GifEmbed: Component<{ href: string }> = (props) => (
  <a
    href={props.href}
    target="_blank"
    rel="noopener noreferrer"
    class="my-1.5 block w-fit max-w-full overflow-hidden rounded-lg border border-border/50 bg-muted/30"
    onClick={(e) => {
      if (!isExternalLink(props.href)) return;
      if (e.shiftKey) return;
      e.preventDefault();
      requestOpenExternalLink(props.href);
    }}
  >
    <img
      src={props.href}
      alt="GIF"
      loading="lazy"
      draggable={false}
      class="block max-h-80 max-w-full rounded-lg object-contain"
    />
  </a>
);

export const MessageBody: Component<MessageBodyProps> = (props) => {
  const navigate = useNavigate();
  const segments = createMemo(() => parseMessageContent(props.text));
  const jumbo = createMemo(() => {
    let count = 0;
    for (const s of segments()) {
      if (s.type === 'emoji' || s.type === 'customEmoji') count++;
      else if (s.type === 'text' && s.content.trim() === '') continue;
      else return false;
    }
    return count > 0 && count <= JUMBO_MAX;
  });
  // A message whose only content is a GIF link (Discord/GIF-picker style) renders as just the
  // GIF, no URL text. A GIF link mixed with other text keeps the link and adds the embed below.
  const loneGifHref = createMemo(() => {
    let href: string | null = null;
    for (const s of segments()) {
      if (s.type === 'link' && isGifUrl(s.href)) {
        if (href) return null; // more than one link
        href = s.href;
      } else if (s.type === 'text' && s.content.trim() === '') {
        continue;
      } else {
        return null;
      }
    }
    return href;
  });

  // Distinct http(s) links worth a preview card - not GIFs (rendered inline already) or space
  // invites (which get their own embed). Capped so a link-dump doesn't fill the screen.
  const previewUrls = createMemo(() => {
    if (!props.allowLinkPreviews) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of segments()) {
      if (s.type !== 'link') continue;
      if (isGifUrl(s.href) || extractSpaceInviteCodeFromUrl(s.href)) continue;
      if (!/^https?:\/\//i.test(s.href) || seen.has(s.href)) continue;
      seen.add(s.href);
      out.push(s.href);
      if (out.length >= 4) break;
    }
    return out;
  });

  return (
    <div class={props.class}>
      <Show when={loneGifHref()} fallback={
      <>
      <For each={segments()}>
        {(seg) => {
          if (seg.type === 'text') {
            return <span class="whitespace-pre-wrap">{seg.content}</span>;
          }
          if (seg.type === 'emoji') {
            return <Emoji emoji={seg.emoji} jumbo={jumbo()} />;
          }
          if (seg.type === 'customEmoji') {
            return <CustomEmoji id={seg.id} name={seg.name} jumbo={jumbo()} />;
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
            const inviteCode = extractSpaceInviteCodeFromUrl(href);
            if (inviteCode) {
              return (
                <div class="block max-w-full my-1.5 space-y-1.5">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary underline underline-offset-2 break-all hover:text-primary/90 cursor-pointer"
                    onClick={(e) => {
                      if (!isExternalLink(href)) return;
                      if (e.shiftKey) return;
                      e.preventDefault();
                      requestOpenExternalLink(href);
                    }}
                  >
                    {seg.text}
                  </a>
                  <SpaceInviteLinkEmbed code={inviteCode} />
                </div>
              );
            }
            const linkAnchor = (
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
            // A GIF link alongside other text: keep the link and add the animation below it.
            // (A message that is only a GIF link is handled by loneGifHref above.)
            if (isGifUrl(href)) {
              return (
                <div class="block max-w-full my-1.5 space-y-1.5">
                  {linkAnchor}
                  <GifEmbed href={href} />
                </div>
              );
            }
            return linkAnchor;
          }
          if (seg.type === 'mention') {
            // Accessor, not a one-shot lookup: participants often finish loading after the
            // message has rendered (a fresh MESSAGE_CREATE beats the member list), and a
            // plain const here rendered "@Unknown" permanently for that message.
            const display = () => {
              const p = props.participants?.find((x) => x.id === seg.userId);
              return p?.display_name || p?.username || t('common.unknown');
            };
            return (
              <Show when={props.onMentionClick} fallback={<span class={brandPill}>@{display()}</span>}>
                <button
                  type="button"
                  class={brandPillClickable}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onMentionClick?.(seg.userId, e.currentTarget);
                  }}
                >
                  @{display()}
                </button>
              </Show>
            );
          }
          if (seg.type === 'roleMention') {
            const role = () => props.spaceRoles?.find((r) => r.id === seg.roleId);
            return (
              <Show
                when={role()}
                fallback={
                  // Role no longer exists (deleted) or this context has no role data (e.g.
                  // a PM rendering old space-channel content) - plain text rather than a
                  // mention pill pointing at nothing.
                  <span class="whitespace-pre-wrap">{`<@&${seg.roleId}>`}</span>
                }
              >
                {(r) => (
                  <span
                    class={`inline-flex items-center gap-1 ${pillBase}`}
                    style={{
                      'background-color': `${spaceRoleColorHex(r().color)}26`,
                      color: spaceRoleColorHex(r().color),
                    }}
                  >
                    @{r().name}
                  </span>
                )}
              </Show>
            );
          }
          if (seg.type === 'channelMention') {
            const channel = () => findChannel(seg.roomId);
            return (
              <Show
                when={channel()}
                fallback={
                  <span class={`${pillBase} bg-muted text-muted-foreground`} title={t('messages.roomUnavailable')}>
                    #unknown
                  </span>
                }
              >
                {(ch) => (
                  <button
                    type="button"
                    class={brandPillClickable}
                    title={t('messages.goToRoom', { name: ch().name })}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/spaces/${ch().spaceId}/rooms/${seg.roomId}`);
                    }}
                  >
                    #{ch().name}
                  </button>
                )}
              </Show>
            );
          }
          if (seg.type === 'everyone') {
            return <span class={brandPill}>{seg.text}</span>;
          }
          return null;
        }}
      </For>
      {props.trailing}
      </>
      }>
        {(href) => (
          <>
            <GifEmbed href={href()} />
            {props.trailing}
          </>
        )}
      </Show>
      <For each={previewUrls()}>{(u) => <LinkPreview url={u} />}</For>
    </div>
  );
};
