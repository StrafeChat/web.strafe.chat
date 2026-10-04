import type { Component } from 'solid-js';
import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { parseMessageContent } from '../../lib/utils/markdown';
import { Emoji } from '../emoji/Emoji';
import { CustomEmoji } from '../emoji/CustomEmoji';
import { extractSpaceInviteCodeFromUrl } from '../../lib/utils/spaceInviteLink';
import { SpaceInviteLinkEmbed } from '../SpaceInviteLinkEmbed';
import { LinkPreview } from './LinkPreview';
import { DynamicTimestamp } from './DynamicTimestamp';
import { VideoPlayer } from '../media';
import { fitWithin } from '../../lib/attachments/format';
import { getMediaDimensions, recordMediaDimensions, hasRecentMediaFailure, recordMediaFailure } from '../../lib/mediaDimensions';
import { mediaKind, type MediaKind } from '../../lib/gif/providers';
import { openMediaViewer } from '../../stores/mediaViewer';
import { previewUrlsFor } from '../../lib/linkPreviewUrls';
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

const guardClick = (href: string) => (e: MouseEvent) => {
  if (!isExternalLink(href)) return;
  if (e.shiftKey) return;
  e.preventDefault();
  requestOpenExternalLink(href);
};

/**
 * Inline media for a bare image/GIF/video link: the media itself, capped and lazy-loaded. A
 * video is a real player; an image/GIF links to its source behind the usual external-link guard.
 *
 * Many hosts serve an HTML page at a media-looking URL ("…/i/x.png" is a preview page, not a
 * PNG), so the file fails to load. When it does, fall back to a link-preview card (unfurl) if the
 * room allows one, else the plain link, so the message never renders as literally nothing.
 */
/** How long to wait for media to load before deciding the URL isn't really media and unfurling
 * it instead. Some hosts serve an HTML page that neither decodes as an image nor fires `error`,
 * so the request just hangs - a timeout is the only reliable signal. */
const MEDIA_LOAD_TIMEOUT_MS = 5000;

/** Last path segment of a URL, for a video player's aria-label / download name. */
function mediaFilename(href: string): string {
  try {
    const name = new URL(href).pathname.split('/').pop();
    return name ? decodeURIComponent(name) : href;
  } catch {
    return href;
  }
}

const MediaEmbed: Component<{ href: string; kind: MediaKind; allowLinkPreviews?: boolean; showLinkOnFail?: boolean }> = (
  props
) => {
  // A link that failed to load recently skips the attempt and goes straight to the fallback,
  // so it doesn't reflow the conversation again a few seconds after the message appears.
  // eslint-disable-next-line solid/reactivity -- href is fixed for the life of this embed (keyed by it)
  const [failed, setFailed] = createSignal(hasRecentMediaFailure(props.href));
  const [shown, setShown] = createSignal(false);
  let imgEl: HTMLImageElement | undefined;
  let ready = false; // set once the media actually loads (img onload, or the player's onReady)
  let timer: number | undefined;
  // Reserve the box from a size we cached the last time we saw this link, so a re-render (scrolling
  // back, re-entering the room) holds space and the image fades in instead of shoving text down.
  const cached = getMediaDimensions(props.href);
  const box = cached ? fitWithin(cached.width, cached.height, 400, 320) : null;
  const isReady = () => ready || !!(imgEl?.complete && imgEl.naturalWidth > 0);
  onMount(() => {
    if (failed()) return;
    // A timeout is not remembered: a slow connection must not turn a working image into a
    // card for the next ten minutes. Only a real load error (onFail) is.
    timer = window.setTimeout(() => {
      if (!isReady()) setFailed(true);
    }, MEDIA_LOAD_TIMEOUT_MS);
  });
  onCleanup(() => clearTimeout(timer));
  const onLoaded = () => {
    ready = true;
    clearTimeout(timer);
    setShown(true);
    if (imgEl) recordMediaDimensions(props.href, imgEl.naturalWidth, imgEl.naturalHeight);
  };
  const onFail = () => {
    clearTimeout(timer);
    recordMediaFailure(props.href);
    setFailed(true);
  };
  return (
    <Show
      when={!failed()}
      fallback={
        <Show
          when={props.allowLinkPreviews}
          fallback={
            <Show when={props.showLinkOnFail}>
              <a
                href={props.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={guardClick(props.href)}
                class="text-primary underline underline-offset-2 break-all hover:text-primary/90"
              >
                {props.href}
              </a>
            </Show>
          }
        >
          <LinkPreview url={props.href} />
        </Show>
      }
    >
      <Show
        when={props.kind === 'video'}
        fallback={
          <button
            type="button"
            class="relative my-1.5 block w-fit max-w-full cursor-zoom-in overflow-hidden rounded-lg border border-border/50 bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            style={box ? { width: `${box.width}px`, height: `${box.height}px` } : undefined}
            onClick={() =>
              openMediaViewer([
                {
                  url: props.href,
                  filename: mediaFilename(props.href),
                  width: imgEl?.naturalWidth || box?.width,
                  height: imgEl?.naturalHeight || box?.height,
                },
              ])
            }
          >
            <Show when={!shown()}>
              <div class={`media-skeleton ${box ? 'absolute inset-0' : 'h-44 w-64 max-w-full'} rounded-lg`} />
            </Show>
            <img
              ref={(el) => (imgEl = el)}
              src={props.href}
              alt={props.kind === 'gif' ? 'GIF' : ''}
              loading="lazy"
              draggable={false}
              onLoad={onLoaded}
              onError={onFail}
              class={`rounded-lg transition-opacity duration-300 ${shown() ? 'opacity-100' : 'opacity-0'} ${
                box ? 'absolute inset-0 size-full object-contain' : shown() ? 'block max-h-80 max-w-full object-contain' : 'absolute'
              }`}
            />
          </button>
        }
      >
        <VideoPlayer
          src={props.href}
          filename={mediaFilename(props.href)}
          onReady={onLoaded}
          onError={onFail}
          class="my-1.5"
        />
      </Show>
    </Show>
  );
};

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
  // A message whose only content is a GIF renders as just the animation, no URL text (the
  // GIF-picker / tenor-giphy behaviour). Image, video and page links keep their URL - and the
  // media or a fallback preview card is embedded below it - so the link is never swallowed.
  const loneGif = createMemo((): { href: string; kind: MediaKind } | null => {
    let found: { href: string; kind: MediaKind } | null = null;
    for (const s of segments()) {
      if (s.type === 'link') {
        if (mediaKind(s.href) !== 'gif' || found) return null; // not a lone GIF
        found = { href: s.href, kind: 'gif' };
      } else if (s.type === 'text' && s.content.trim() === '') {
        continue;
      } else {
        return null;
      }
    }
    return found;
  });

  // Distinct http(s) links worth a preview card - not inline media (GIF/image/video, rendered
  // directly) or space invites (their own embed). Capped so a link-dump doesn't fill the screen.
  const previewUrls = createMemo(() => (props.allowLinkPreviews ? previewUrlsFor(props.text) : []));

  return (
    <div class={props.class}>
      <Show when={loneGif()} fallback={
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
            // A media link (GIF/image/video): keep the link and add the media (or, if the URL
            // turns out to be an HTML page, a preview card) below it. A message that is only a
            // GIF is handled by loneGif above and shows just the animation.
            const kind = mediaKind(href);
            if (kind) {
              return (
                <div class="block max-w-full my-1.5 space-y-1.5">
                  {linkAnchor}
                  <MediaEmbed href={href} kind={kind} allowLinkPreviews={props.allowLinkPreviews} />
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
          if (seg.type === 'timestamp') {
            return <DynamicTimestamp unix={seg.unix} style={seg.style} />;
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
        {(media) => (
          <>
            <MediaEmbed href={media().href} kind={media().kind} allowLinkPreviews={props.allowLinkPreviews} showLinkOnFail />
            {props.trailing}
          </>
        )}
      </Show>
      <For each={previewUrls()}>{(u) => <LinkPreview url={u} />}</For>
    </div>
  );
};
