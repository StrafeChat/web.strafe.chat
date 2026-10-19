import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { isExternalLink, requestOpenExternalLink } from '../stores/externalLink';

marked.setOptions({ gfm: true, breaks: true });

let linkHookInstalled = false;
function ensureExternalLinkHook(): void {
  if (linkHookInstalled) return;
  linkHookInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName !== 'A' || !(node instanceof HTMLAnchorElement)) return;
    if (!/^https?:/i.test(node.getAttribute('href') ?? '')) return;
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
    node.setAttribute('data-bio-link', '1');
  });
}

// Bio HTML is set as innerHTML, so its links cannot carry handlers; one delegated listener
// sends them through the same "leaving Strafe" confirmation every other link gets. A bio
// is the one place a stranger's link sits beside a trusted-looking profile.
let clickHookInstalled = false;
function ensureBioLinkClickHook(): void {
  if (clickHookInstalled || typeof document === 'undefined') return;
  clickHookInstalled = true;
  document.addEventListener(
    'click',
    (ev) => {
      const a = (ev.target as Element | null)?.closest?.('a[data-bio-link]');
      if (!(a instanceof HTMLAnchorElement)) return;
      const href = a.getAttribute('href') ?? '';
      if (!isExternalLink(href)) return;
      ev.preventDefault();
      requestOpenExternalLink(href);
    },
    true
  );
}

/**
 * Bio field: Markdown + limited HTML, rendered then sanitized for safe innerHTML.
 *
 * Beyond DOMPurify's script/event-handler stripping, anything that makes the viewer's
 * browser fetch a URL of the author's choosing is removed: an <img> in a bio is a tracking
 * pixel that reports every profile viewer's IP address to whoever wrote it. Text-level
 * formatting (headings, lists, links, code, quotes) is all that a bio needs.
 */
export function markdownAndHtmlToSanitizedBioHtml(src: string): string {
  const t = src.trim();
  if (!t) return '';
  ensureExternalLinkHook();
  ensureBioLinkClickHook();
  const raw = marked.parse(t, { async: false }) as string;
  // class and id go too: with them a bio can borrow the app's own styles - a full-viewport
  // "page" over the profile, a fake dialog - and style is already out for the same reason.
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['img', 'picture', 'source', 'video', 'audio', 'iframe', 'object', 'embed', 'svg', 'math', 'style', 'form', 'input', 'button', 'textarea', 'select'],
    FORBID_ATTR: ['style', 'class', 'id', 'srcset', 'src', 'poster', 'background'],
  });
}
