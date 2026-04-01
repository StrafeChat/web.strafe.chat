/**
 * Lightweight markdown-like parsing for chat messages: bold, italic, inline code,
 * code blocks, [text](url), bare URLs, and @mentions.
 * Output is an array of segments for safe rendering (no raw HTML).
 */

export type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'code'; content: string }
  | { type: 'codeBlock'; lang: string; content: string }
  | { type: 'link'; href: string; text: string }
  | { type: 'mention'; username: string }
  | { type: 'mention'; userId: string };

const BARE_URL =
  /https?:\/\/[^\s\]\)<>"]+|www\.[^\s\]\)<>"]+/i;
/** Discord-style: <@userId> */
const MENTION_ID = /^<@([^>]+)>/;
/** Plain @username */
const MENTION = /@([a-zA-Z0-9_.-]+)/;

/** Only allow http/https for link href. */
function sanitizeHref(url: string): string {
  const t = url.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/^www\./i.test(t)) return `https://${t}`;
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

    // Discord-style mention: <@userId>
    const mentionIdMatch = text.slice(i).match(MENTION_ID);
    if (mentionIdMatch) {
      out.push({ type: 'mention', userId: mentionIdMatch[1]! });
      i += mentionIdMatch[0]!.length;
      continue;
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

    // @username (plain mention)
    const mentionMatch = text.slice(i).match(MENTION);
    if (mentionMatch) {
      out.push({ type: 'mention', username: mentionMatch[1]! });
      i += mentionMatch[0]!.length;
      continue;
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
        (c === 'w' && /^www\./i.test(rest))
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
