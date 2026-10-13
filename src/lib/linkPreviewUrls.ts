import { parseMessageContent, walkSegments } from './utils/markdown';
import { mediaKind } from './gif/providers';
import { extractSpaceInviteCodeFromUrl } from './utils/spaceInviteLink';

/** At most this many preview cards per message, so a link dump doesn't fill the screen. */
export const MAX_PREVIEWS_PER_MESSAGE = 4;

/**
 * The distinct http(s) links in a message that get a preview card: not inline media (a GIF,
 * image or video link renders directly), not a space invite (its own embed), and not a link
 * inside a spoiler. One definition shared by the message body (which renders the cards) and
 * the history loader (which warms their metadata before the messages are shown), so the two
 * can never disagree about which links matter.
 */
export function previewUrlsFor(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  // Walks into blocks and styling too: a link inside a quote or a bold run is still a link.
  // Not into a spoiler, though: a card under the message would show what the spoiler hides
  // (the page's title and image) without anyone clicking it.
  walkSegments(parseMessageContent(text), (node) => {
    if (node.type === 'spoiler') return false;
    if (node.type !== 'link' || node.suppressed || out.length >= MAX_PREVIEWS_PER_MESSAGE) return;
    if (mediaKind(node.href) || extractSpaceInviteCodeFromUrl(node.href)) return;
    if (!/^https?:\/\//i.test(node.href) || seen.has(node.href)) return;
    seen.add(node.href);
    out.push(node.href);
  });
  return out;
}
