import DOMPurify from 'dompurify';
import { normalizeNumberedEnvironments } from './latex';

const MAX_DOCUMENT_LENGTH = 20000;

type LatexJs = typeof import('latex.js');

let latexjsModule: LatexJs | null = null;
let latexjsLoading: Promise<LatexJs> | null = null;

export function latexjsIfLoaded(): LatexJs | null {
  return latexjsModule;
}

export function loadLatexJs(): Promise<LatexJs> {
  if (latexjsModule) return Promise.resolve(latexjsModule);
  if (!latexjsLoading) {
    latexjsLoading = import('latex.js')
      .then((mod) => {
        latexjsModule = mod;
        return mod;
      })
      .catch((err) => {
        latexjsLoading = null;
        throw err;
      });
  }
  return latexjsLoading;
}

export interface LatexDocumentResult {
  html: string;
  error?: string;
}

const CACHE_LIMIT = 50;
const renderCache = new Map<string, LatexDocumentResult>();

const FORBID_TAGS = [
  'script',
  'style',
  'link',
  'meta',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'img',
  'picture',
  'source',
  'video',
  'audio',
  'svg',
  'canvas',
  'math',
];

const FORBID_ATTR = ['id', 'src', 'srcset', 'poster', 'background', 'action', 'formaction', 'xlink:href'];

function sanitize(html: string): string {
  const cleaned = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS,
    FORBID_ATTR,
  });
  const holder = document.createElement('div');
  holder.innerHTML = cleaned;
  for (const link of holder.querySelectorAll('a')) {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  }
  return holder.innerHTML;
}

export function renderLatexDocument(source: string): LatexDocumentResult | null {
  const latexjs = latexjsModule;
  if (!latexjs) return null;
  const cached = renderCache.get(source);
  if (cached) return cached;

  let result: LatexDocumentResult;
  if (source.length > MAX_DOCUMENT_LENGTH) {
    result = { html: '', error: 'LaTeX document is too long' };
  } else {
    try {
      const generator = new latexjs.HtmlGenerator({ hyphenate: false, documentClass: 'article' });
      const parsed = latexjs.parse(normalizeNumberedEnvironments(source), { generator });
      const fragment = parsed.domFragment();
      const holder = document.createElement('div');
      holder.appendChild(fragment);
      result = { html: sanitize(holder.innerHTML) };
    } catch (err) {
      result = { html: '', error: err instanceof Error ? err.message : String(err) };
    }
  }

  if (renderCache.size >= CACHE_LIMIT) {
    const oldest = renderCache.keys().next().value;
    if (oldest !== undefined) renderCache.delete(oldest);
  }
  renderCache.set(source, result);
  return result;
}
