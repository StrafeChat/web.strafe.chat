import DOMPurify from 'dompurify';
import { marked } from 'marked';

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
  });
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
  const raw = marked.parse(t, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['img', 'picture', 'source', 'video', 'audio', 'iframe', 'object', 'embed', 'svg', 'math', 'style', 'form', 'input', 'button', 'textarea', 'select'],
    FORBID_ATTR: ['style', 'srcset', 'src', 'poster', 'background'],
  });
}
