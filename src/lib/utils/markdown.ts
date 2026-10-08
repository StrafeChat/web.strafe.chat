/**
 * Discord-flavoured markdown for chat messages, parsed into a tree of nodes for safe
 * rendering (no raw HTML anywhere).
 *
 * Two layers, the way Discord's own grammar works:
 *  - block level, decided per line: fenced code, headings (`#`..`###`), subtext (`-#`),
 *    quotes (`>` and `>>>`), and ordered/unordered lists.
 *  - inline, inside every block: ***bold italic***, **bold**, *italic*, __underline__,
 *    ~~strikethrough~~, ||spoiler||, `code`, links, mentions, timestamps and emoji.
 *
 * Inline styling nests (`**bold with *italic* in it**`, `||spoiled **bold**||`), which is
 * why the styling nodes carry children rather than a string: a flat string could only ever
 * render one level and showed the inner markers as literal text.
 */
import { emojiAt } from '../emoji/regex';
import { timestampStyle, type TimestampStyle } from './messageTimestamp';

/** Inline leaves and containers, plus the block nodes a message can start a line with. */
export type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string }
  | { type: 'codeBlock'; lang: string; content: string }
  /** `suppressed` is Discord's <https://example.com>: still a link, but no preview card,
   * no inline image or video, and no invite card either. */
  | { type: 'link'; href: string; text: string; suppressed?: boolean }
  | { type: 'mention'; userId: string }
  | { type: 'roleMention'; roleId: string }
  | { type: 'channelMention'; roomId: string }
  | { type: 'everyone'; text: string }
  /** Dynamic timestamp: <t:unixSeconds[:style]> - rendered in the *reader's* timezone. */
  | { type: 'timestamp'; unix: number; style: TimestampStyle }
  /** One Unicode emoji sequence (rendered by the chosen image provider). */
  | { type: 'emoji'; emoji: string }
  /** Space custom emoji: <:name:id> or <a:name:id>. */
  | { type: 'customEmoji'; name: string; id: string; animated: boolean }
  /** Inline containers - their children are themselves segments. */
  | { type: 'bold'; children: MessageSegment[] }
  | { type: 'italic'; children: MessageSegment[] }
  | { type: 'underline'; children: MessageSegment[] }
  | { type: 'strike'; children: MessageSegment[] }
  | { type: 'spoiler'; children: MessageSegment[] }
  /** Blocks. */
  | { type: 'heading'; level: 1 | 2 | 3; children: MessageSegment[] }
  | { type: 'subtext'; children: MessageSegment[] }
  | { type: 'quote'; children: MessageSegment[] }
  | { type: 'listItem'; ordered: boolean; marker: string; depth: number; children: MessageSegment[] };

/** The inline containers, for callers that want to walk into them. */
const CONTAINER_TYPES = new Set([
  'bold', 'italic', 'underline', 'strike', 'spoiler', 'heading', 'subtext', 'quote', 'listItem',
]);

function childrenOf(node: MessageSegment): MessageSegment[] | undefined {
  return CONTAINER_TYPES.has(node.type) ? (node as { children: MessageSegment[] }).children : undefined;
}

/** Depth-first walk over a parsed message, containers included. */
export function walkSegments(nodes: MessageSegment[], visit: (node: MessageSegment) => void): void {
  for (const node of nodes) {
    visit(node);
    const kids = childrenOf(node);
    if (kids) walkSegments(kids, visit);
  }
}

/** Anchored: this is matched against `text.slice(i)` and the match length is used to advance
 * the cursor. Unanchored, a URL anywhere later in the message matched from the current
 * position, so "hey <@id> look https://x" rendered as the URL repeated over the whole text. */
const BARE_URL = /^(?:https?:\/\/[^\s\])<>"]+|www\.[^\s\])<>"]+)/i;
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
/** Dynamic timestamp: <t:unixSeconds[:style]> - the style letter is optional ('f' by default).
 *  Seconds are bounded to 11 digits (year 5138) so the value can never overflow into an
 *  Invalid Date; anything longer simply fails to match here and is rendered as the literal
 *  text it is. A leading `-` allows pre-1970 instants. */
const DYNAMIC_TIMESTAMP = /^<t:(-?\d{1,11})(?::([tTdDfFR]))?>/;

/** Block openers, all anchored at the start of a line. */
const HEADING = /^(#{1,3})\s+(.*)$/;
const SUBTEXT = /^-#\s+(.*)$/;
const QUOTE = /^>\s(.*)$/;
const QUOTE_BLOCK = /^>>>\s?/;
const UNORDERED_ITEM = /^(\s*)[-*]\s+(.*)$/;
const ORDERED_ITEM = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
/** Deeper than this and the indent is just text; Discord stops nesting here too. */
const MAX_LIST_DEPTH = 2;

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
    /^\/invite\/[a-zA-Z0-9]+(?:(?:@|%40)[a-zA-Z0-9.-]+(?:(?::|%3A)\d+)?)?\/?$/.test(pathOnly)
  ) {
    return typeof window !== 'undefined' ? `${window.location.origin}${t}` : t;
  }
  return '';
}

/** A paired inline marker: `marker` opens and closes, and the text between is parsed again. */
interface Delimiter {
  open: string;
  type: 'bold' | 'italic' | 'underline' | 'strike' | 'spoiler';
}

/** Longest first, so *** beats ** beats *, and __ beats _. */
const DELIMITERS: Delimiter[] = [
  { open: '***', type: 'bold' }, // bold + italic; the italic wrapper is added below
  { open: '**', type: 'bold' },
  { open: '__', type: 'underline' },
  { open: '~~', type: 'strike' },
  { open: '||', type: 'spoiler' },
  { open: '*', type: 'italic' },
  { open: '_', type: 'italic' },
];

/** Find the closing run of `marker` after `from`, or -1. Skips an escaped marker. */
function findClosing(text: string, marker: string, from: number): number {
  let at = text.indexOf(marker, from);
  while (at > 0 && text[at - 1] === '\\') at = text.indexOf(marker, at + marker.length);
  return at;
}

/**
 * Parse inline content: everything that can appear inside a line of a message.
 * Recursive - a styling marker re-enters with the text it wraps.
 */
function parseInline(text: string): MessageSegment[] {
  const out: MessageSegment[] = [];
  let i = 0;
  const len = text.length;

  const pushText = (s: string) => {
    if (!s) return;
    const last = out[out.length - 1];
    if (last?.type === 'text') last.content += s;
    else out.push({ type: 'text', content: s });
  };

  while (i < len) {
    const rest = text.slice(i);

    // A backslash escapes the next character, so "\*not italic\*" reads literally.
    if (text[i] === '\\' && i + 1 < len && /[*_~|`>#\\[\]()-]/.test(text[i + 1]!)) {
      pushText(text[i + 1]!);
      i += 2;
      continue;
    }

    // Inline code: ` content ` (no newlines). Before everything else - nothing inside
    // backticks is markup.
    const inlineCode = rest.match(/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/);
    if (inlineCode) {
      out.push({ type: 'code', content: inlineCode[2]! });
      i += inlineCode[0]!.length;
      continue;
    }

    // Markdown link: [text](url) or [text](<url>)
    const mdLink = rest.match(/^\[([^\]]*)\]\(\s*(<[^>]+>|[^\s)]+)\s*\)/);
    if (mdLink) {
      let href = mdLink[2]!.trim();
      if (href.startsWith('<') && href.endsWith('>')) href = href.slice(1, -1);
      const safe = sanitizeHref(href);
      if (safe) {
        out.push({ type: 'link', href: safe, text: mdLink[1]! || safe });
        i += mdLink[0]!.length;
        continue;
      }
    }

    // <https://example.com>: the author asking for no embed. The brackets are not shown;
    // everything that would normally unfurl this link checks the flag instead.
    const wrapped = rest.match(/^<((?:https?:\/\/|www\.)[^\s<>]+)>/i);
    if (wrapped) {
      const safe = sanitizeHref(wrapped[1]!);
      if (safe) {
        out.push({ type: 'link', href: safe, text: wrapped[1]!, suppressed: true });
        i += wrapped[0]!.length;
        continue;
      }
    }

    // Dynamic timestamp: <t:unixSeconds[:style]> - an absolute instant, so every reader
    // renders it in their own timezone and locale.
    const ts = rest.match(DYNAMIC_TIMESTAMP);
    if (ts) {
      out.push({ type: 'timestamp', unix: Number(ts[1]), style: timestampStyle(ts[2]) });
      i += ts[0]!.length;
      continue;
    }

    // Role mention: <@&roleId> - must be checked before the user-mention pattern.
    const roleM = rest.match(MENTION_ROLE_ID);
    if (roleM) {
      out.push({ type: 'roleMention', roleId: roleM[1]! });
      i += roleM[0]!.length;
      continue;
    }

    const userM = rest.match(MENTION_USER_ID);
    if (userM) {
      out.push({ type: 'mention', userId: userM[1]! });
      i += userM[0]!.length;
      continue;
    }

    const chanM = rest.match(MENTION_CHANNEL_ID);
    if (chanM) {
      out.push({ type: 'channelMention', roomId: chanM[1]! });
      i += chanM[0]!.length;
      continue;
    }

    const emojiM = rest.match(CUSTOM_EMOJI);
    if (emojiM) {
      out.push({ type: 'customEmoji', animated: emojiM[1] === 'a', name: emojiM[2]!, id: emojiM[3]! });
      i += emojiM[0]!.length;
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
      const everyone = rest.match(MENTION_EVERYONE);
      if (everyone) {
        out.push({ type: 'everyone', text: everyone[0]! });
        i += everyone[0]!.length;
        continue;
      }
    }

    const url = rest.match(BARE_URL);
    if (url) {
      const href = sanitizeHref(url[0]!);
      if (href) {
        out.push({ type: 'link', href, text: url[0]! });
        i += url[0]!.length;
        continue;
      }
    }

    // Styling markers. The content between them is parsed again, so they nest.
    const delim = DELIMITERS.find((d) => rest.startsWith(d.open));
    if (delim) {
      const close = findClosing(text, delim.open, i + delim.open.length);
      // Underscores only mark emphasis at a word boundary, so snake_case_names and
      // file_names_like_this stay literal; asterisks work inside a word, as in Discord.
      const underscore = delim.open[0] === '_';
      const boundaryOk =
        !underscore ||
        ((i === 0 || !/\w/.test(text[i - 1]!)) &&
          !/\w/.test(text[close + delim.open.length] ?? ''));
      if (boundaryOk && close > i + delim.open.length) {
        const inner = text.slice(i + delim.open.length, close);
        const children = parseInline(inner);
        // *** is bold *and* italic, which is two nodes deep rather than a type of its own.
        out.push(
          delim.open === '***'
            ? { type: 'bold', children: [{ type: 'italic', children }] }
            : ({ type: delim.type, children } as MessageSegment)
        );
        i = close + delim.open.length;
        continue;
      }
    }

    // Plain text up to the next character that could start something.
    let j = i;
    while (j < len) {
      const c = text[j]!;
      if (
        c === '`' || c === '[' || c === '<' || c === '@' || c === '*' || c === '_' ||
        c === '~' || c === '|' || c === '\\' ||
        (c === 'h' && /^https?:\/\//i.test(text.slice(j))) ||
        (c === 'w' && /^www\./i.test(text.slice(j))) ||
        startsEmoji(text, j)
      ) break;
      j++;
    }
    if (j > i) {
      pushText(text.slice(i, j));
      i = j;
      continue;
    }
    pushText(text[i]!);
    i += 1;
  }

  return out;
}

/** Everything in a fenced block is literal, so fences are pulled out before anything else. */
const FENCE = /^```([A-Za-z0-9+#._-]*)\n([\s\S]*?)```/;

/**
 * Parse message content into renderable segments.
 */
export function parseMessageContent(text: string): MessageSegment[] {
  const out: MessageSegment[] = [];
  // Fenced code can span lines, so it is taken off the front before the line splitter sees
  // it; everything between two fences is literal, markers included.
  let rest = text;
  while (rest.length > 0) {
    const fenceAt = rest.indexOf('```');
    const fence = fenceAt >= 0 ? rest.slice(fenceAt).match(FENCE) : null;
    if (!fence) {
      out.push(...parseLines(rest));
      break;
    }
    if (fenceAt > 0) out.push(...parseLines(rest.slice(0, fenceAt)));
    out.push({ type: 'codeBlock', lang: fence[1]!.trim(), content: fence[2]!.replace(/\n$/, '') });
    rest = rest.slice(fenceAt + fence[0]!.length);
  }
  return out;
}

/** Block structure, line by line. Lines that open nothing are inline content. */
function parseLines(text: string): MessageSegment[] {
  const out: MessageSegment[] = [];
  const lines = text.split('\n');

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]!;
    const atEnd = n === lines.length - 1;
    const newline = () => {
      if (!atEnd) out.push({ type: 'text', content: '\n' });
    };

    // >>> quotes the whole rest of the message.
    if (QUOTE_BLOCK.test(line)) {
      const body = [line.replace(QUOTE_BLOCK, ''), ...lines.slice(n + 1)].join('\n');
      out.push({ type: 'quote', children: parseLines(body) });
      return out;
    }

    const heading = line.match(HEADING);
    if (heading) {
      out.push({
        type: 'heading',
        level: heading[1]!.length as 1 | 2 | 3,
        children: parseInline(heading[2]!),
      });
      continue;
    }

    const subtext = line.match(SUBTEXT);
    if (subtext) {
      out.push({ type: 'subtext', children: parseInline(subtext[1]!) });
      continue;
    }

    // Consecutive `> ` lines are one quote, the way Discord merges them.
    const quote = line.match(QUOTE);
    if (quote) {
      const body = [quote[1]!];
      while (n + 1 < lines.length) {
        const next = lines[n + 1]!.match(QUOTE);
        if (!next) break;
        body.push(next[1]!);
        n++;
      }
      out.push({ type: 'quote', children: parseLines(body.join('\n')) });
      if (n < lines.length - 1) out.push({ type: 'text', content: '\n' });
      continue;
    }

    const ordered = line.match(ORDERED_ITEM);
    const unordered = ordered ? null : line.match(UNORDERED_ITEM);
    if (ordered || unordered) {
      const indent = (ordered ? ordered[1]! : unordered![1]!).length;
      const depth = Math.min(Math.floor(indent / 2), MAX_LIST_DEPTH);
      out.push({
        type: 'listItem',
        ordered: !!ordered,
        marker: ordered ? `${ordered[2]!}.` : '•',
        depth,
        children: parseInline(ordered ? ordered[3]! : unordered![2]!),
      });
      continue;
    }

    out.push(...parseInline(line));
    newline();
  }

  return out;
}
