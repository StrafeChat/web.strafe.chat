/**
 * Lightweight markdown-like parsing for chat messages: bold, italic, inline code,
 * code blocks, [text](url), bare URLs, @mentions, and emoji (Unicode + custom).
 * Output is an array of segments for safe rendering (no raw HTML).
 */
import { emojiAt } from '../emoji/regex';

export type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'code'; content: string }
  | { type: 'codeBlock'; lang: string; content: string }
  | { type: 'link'; href: string; text: string }
  | { type: 'mention'; userId: string }
  | { type: 'roleMention'; roleId: string }
  | { type: 'channelMention'; roomId: string }
  | { type: 'everyone'; text: string }
  /** One Unicode emoji sequence (rendered by the chosen image provider). */
  | { type: 'emoji'; emoji: string }
  /** Space custom emoji: <:name:id> or <a:name:id>. */
  | { type: 'customEmoji'; name: string; id: string; animated: boolean };

/** Anchored: this is matched against `text.slice(i)` and the match length is used to advance
 * the cursor. Unanchored, a URL anywhere later in the message matched from the current
 * position, so "hey <@id> look https://x" rendered as the URL repeated over the whole text. */
const BARE_URL =
  /^(?:https?:\/\/[^\s\])<>"]+|www\.[^\s\])<>"]+)/i;
/** User mention: <@userId> or <@!userId> - digits only, matching the backend's mentionUserRe
 * exactly. The previous `[^>]+` version was loose enough to also swallow role mentions
 * (<@&roleId>), resolving them as a bogus "@Unknown" user instead of a role pill. */
const MENTION_USER_ID = /^<@!?(\d+)>/;
/** Role mention: <@&roleId> - checked before MENTION_USER_ID's turn in the loop below. */
const MENTION_ROLE_ID = /^<@&(\d+)>/;
/** Channel mention: <#roomId> - client-side only (the server treats it as plain text). */
const MENTION_CHANNEL_ID = /^<#(\d+)>/;
/** @everyone / @here as a literal token, not <@...> bracket syntax (matches the backend's
 * word-boundary-aware detection - trailing boundary via lookahead here; leading boundary
 * is checked by the caller via the preceding character, since this only sees what's ahead). */
const MENTION_EVERYONE = /^@(everyone|here)(?!\w)/;
/** Custom emoji: <:name:id> (static) or <a:name:id> (animated) - Discord's wire syntax. */
const CUSTOM_EMOJI = /^<(a?):([A-Za-z0-9_]{2,32}):(\d+)>/;

/** Does an emoji sequence start at `j`? Cheap gate first so ASCII prose never hits the
 * Unicode-property regex: only non-Latin-1 code units, or a keycap base followed by its
 * combiner, can begin one. */
function startsEmoji(text: string, j: number): boolean {
  const code = text.charCodeAt(j);
  if (code > 0xff) return emojiAt(text, j) != null;
  if ((code >= 48 && code <= 57) || code === 35 || code === 42) {
    const next = text.charCodeAt(j + 1);
    return (next === 0xfe0f || next === 0x20e3) && emojiAt(text, j) != null;
  }
  return false;
}

/** Only allow http/https for link href; same-origin `/invite/:code` for space invites. */
function sanitizeHref(url: string): string {
  const t = url.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/^www\./i.test(t)) return `https://${t}`;
  const pathOnly = t.split('?')[0]?.split('#')[0] ?? t;
  if (
    pathOnly.startsWith('/') &&
    !pathOnly.startsWith('//') &&
    /^\/invite\/[a-zA-Z0-9]+\/?$/.test(pathOnly)
  ) {
    return typeof window !== 'undefined' ? `${window.location.origin}${t}` : t;
  }
  return '';
}

/**
 * Parse message content into segments for rendering.
 * Order of matching: code blocks → inline code → markdown links → bare URLs → @mentions → **bold** → *italic*.
 */
export function parseMessageContent(text: string): MessageSegment[] {
  const out: MessageSegment[] = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    // Code block: ``` optional_lang \n content ```
    const codeBlockMatch = text.slice(i).match(/^```(\w*)\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      const full = codeBlockMatch[0]!;
      const lang = codeBlockMatch[1]!.trim();
      const content = codeBlockMatch[2]!.replace(/\n$/, '');
      out.push({ type: 'codeBlock', lang, content });
      i += full.length;
      continue;
    }

    // Inline code: ` content ` (no newlines)
    const inlineCodeMatch = text.slice(i).match(/^`([^`\n]+)`/);
    if (inlineCodeMatch) {
      out.push({ type: 'code', content: inlineCodeMatch[1]! });
      i += inlineCodeMatch[0]!.length;
      continue;
    }

    // Markdown link: [text](url) or [text](<url>)
    const mdLinkMatch = text.slice(i).match(/^\[([^\]]*)\]\(\s*(<[^>]+>|[^\s)]+)\s*\)/);
    if (mdLinkMatch) {
      const linkText = mdLinkMatch[1]!;
      let href = mdLinkMatch[2]!.trim();
      if (href.startsWith('<') && href.endsWith('>')) href = href.slice(1, -1);
      const safe = sanitizeHref(href);
      if (safe) {
        out.push({ type: 'link', href: safe, text: linkText || safe });
        i += mdLinkMatch[0]!.length;
        continue;
      }
    }

    // Role mention: <@&roleId> - must be checked before the user-mention pattern.
    const mentionRoleMatch = text.slice(i).match(MENTION_ROLE_ID);
    if (mentionRoleMatch) {
      out.push({ type: 'roleMention', roleId: mentionRoleMatch[1]! });
      i += mentionRoleMatch[0]!.length;
      continue;
    }

    // Mention: <@userId> or <@!userId>
    const mentionIdMatch = text.slice(i).match(MENTION_USER_ID);
    if (mentionIdMatch) {
      out.push({ type: 'mention', userId: mentionIdMatch[1]! });
      i += mentionIdMatch[0]!.length;
      continue;
    }

    // Channel mention: <#roomId>
    const channelMatch = text.slice(i).match(MENTION_CHANNEL_ID);
    if (channelMatch) {
      out.push({ type: 'channelMention', roomId: channelMatch[1]! });
      i += channelMatch[0]!.length;
      continue;
    }

    // Custom emoji: <:name:id> / <a:name:id>
    const customEmojiMatch = text.slice(i).match(CUSTOM_EMOJI);
    if (customEmojiMatch) {
      out.push({
        type: 'customEmoji',
        animated: customEmojiMatch[1] === 'a',
        name: customEmojiMatch[2]!,
        id: customEmojiMatch[3]!,
      });
      i += customEmojiMatch[0]!.length;
      continue;
    }

    // Unicode emoji (one full sequence: ZWJ families, skin tones, flags, keycaps…)
    if (startsEmoji(text, i)) {
      const emoji = emojiAt(text, i)!;
      out.push({ type: 'emoji', emoji });
      i += emoji.length;
      continue;
    }

    // @everyone / @here - only at a word boundary on both sides ("bob@everyone" doesn't
    // count; the trailing boundary is in MENTION_EVERYONE's own lookahead).
    if (text[i] === '@' && (i === 0 || !/\w/.test(text[i - 1]!))) {
      const everyoneMatch = text.slice(i).match(MENTION_EVERYONE);
      if (everyoneMatch) {
        out.push({ type: 'everyone', text: everyoneMatch[0]! });
        i += everyoneMatch[0]!.length;
        continue;
      }
    }

    // Bare URL
    const urlMatch = text.slice(i).match(BARE_URL);
    if (urlMatch) {
      const raw = urlMatch[0]!;
      const href = sanitizeHref(raw);
      if (href) {
        out.push({ type: 'link', href, text: raw });
        i += raw.length;
        continue;
      }
    }

    // **bold** or __bold__
    const boldMatch = text.slice(i).match(/^\*\*([^*]+)\*\*/) ?? text.slice(i).match(/^__([^_]+)__/);
    if (boldMatch) {
      out.push({ type: 'bold', content: boldMatch[1]! });
      i += boldMatch[0]!.length;
      continue;
    }

    // *italic* or _italic_
    const italicMatch = text.slice(i).match(/^\*([^*]+)\*/) ?? text.slice(i).match(/^_([^_]+)_/);
    if (italicMatch) {
      out.push({ type: 'italic', content: italicMatch[1]! });
      i += italicMatch[0]!.length;
      continue;
    }

    // Consume a run of plain text (until next special character)
    let j = i;
    while (j < len) {
      const c = text[j];
      const rest = text.slice(j);
      if (
        c === '`' ||
        c === '[' ||
        c === '<' ||
        c === '@' ||
        c === '*' ||
        c === '_' ||
        (c === 'h' && /^https?:\/\//i.test(rest)) ||
        (c === 'w' && /^www\./i.test(rest)) ||
        startsEmoji(text, j)
      ) break;
      j++;
    }
    if (j > i) {
      out.push({ type: 'text', content: text.slice(i, j) });
      i = j;
      continue;
    }
    out.push({ type: 'text', content: text[i]! });
    i += 1;
  }

  return out;
}
