import { parseMessageContent } from './utils/markdown';
import { mediaKind } from './gif/providers';
import { extractSpaceInviteCodeFromUrl } from './utils/spaceInviteLink';

/** At most this many preview cards per message, so a link dump doesn't fill the screen. */
export const MAX_PREVIEWS_PER_MESSAGE = 4;

/**
 * The distinct http(s) links in a message that get a preview card: not inline media (a GIF,
 * image or video link renders directly) and not a space invite (its own embed). One
 * definition shared by the message body (which renders the cards) and the history loader
 * (which warms their metadata before the messages are shown), so the two can never
 * disagree about which links matter.
 */
export function previewUrlsFor(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of parseMessageContent(text)) {
    if (s.type !== 'link') continue;
    if (mediaKind(s.href) || extractSpaceInviteCodeFromUrl(s.href)) continue;
    if (!/^https?:\/\//i.test(s.href) || seen.has(s.href)) continue;
    seen.add(s.href);
    out.push(s.href);
    if (out.length >= MAX_PREVIEWS_PER_MESSAGE) break;
  }
  return out;
}
