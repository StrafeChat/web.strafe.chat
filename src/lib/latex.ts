import type { KatexOptions } from 'katex';

export interface LatexMatch {
  tex: string;
  display: boolean;
  end: number;
}

const MAX_MATH_LENGTH = 5000;

const BEGIN_ENV = /^\\begin\{([A-Za-z]+\*?)\}/;

function isEscaped(text: string, at: number): boolean {
  let slashes = 0;
  for (let i = at - 1; i >= 0 && text[i] === '\\'; i--) slashes++;
  return slashes % 2 === 1;
}

function findClose(text: string, needle: string, from: number): number {
  let at = text.indexOf(needle, from);
  while (at !== -1) {
    if (!isEscaped(text, at)) return at;
    at = text.indexOf(needle, at + 1);
  }
  return -1;
}

function matchDollarInline(text: string, at: number): LatexMatch | null {
  if (text[at] !== '$' || text[at + 1] === '$') return null;
  const first = text[at + 1];
  if (first == null || /\s/.test(first)) return null;
  let close = at + 1;
  while (true) {
    close = text.indexOf('$', close);
    if (close === -1) return null;
    if (isEscaped(text, close)) {
      close += 1;
      continue;
    }
    if (text[close + 1] === '$') {
      close += 2;
      continue;
    }
    break;
  }
  const inner = text.slice(at + 1, close);
  if (!inner || inner.length > MAX_MATH_LENGTH) return null;
  if (/\s$/.test(inner)) return null;
  if (/\d/.test(text[close + 1] ?? '')) return null;
  return { tex: inner, display: false, end: close + 1 };
}

export function matchLatex(text: string, at: number): LatexMatch | null {
  const rest = text.slice(at);

  if (rest.startsWith('$$')) {
    const close = findClose(text, '$$', at + 2);
    if (close === -1) return null;
    const tex = text.slice(at + 2, close);
    if (!tex.trim() || tex.length > MAX_MATH_LENGTH) return null;
    return { tex, display: true, end: close + 2 };
  }

  if (rest.startsWith('\\[')) {
    const close = findClose(text, '\\]', at + 2);
    if (close === -1) return null;
    const tex = text.slice(at + 2, close);
    if (!tex.trim() || tex.length > MAX_MATH_LENGTH) return null;
    return { tex, display: true, end: close + 2 };
  }
  if (rest.startsWith('\\(')) {
    const close = findClose(text, '\\)', at + 2);
    if (close === -1) return null;
    const tex = text.slice(at + 2, close);
    if (!tex.trim() || tex.length > MAX_MATH_LENGTH) return null;
    return { tex, display: false, end: close + 2 };
  }

  const begin = rest.match(BEGIN_ENV);
  if (begin) {
    const endToken = `\\end{${begin[1]}}`;
    const close = findClose(text, endToken, at + begin[0].length);
    if (close === -1) return null;
    const tex = text.slice(at, close + endToken.length);
    if (tex.length > MAX_MATH_LENGTH) return null;
    return { tex, display: true, end: close + endToken.length };
  }

  return matchDollarInline(text, at);
}

const DOCUMENT_SIGNAL =
  /\\(?:documentclass|usepackage|begin\s*\{(?:document|itemize|enumerate|description|center|flushleft|flushright|quote|quotation|abstract|titlepage)\}|(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph|maketitle|tableofcontents|title|author|date|thanks|item)\b)/;

export function isLatexDocument(source: string): boolean {
  return DOCUMENT_SIGNAL.test(source);
}

const BARE_MATH_SIGNAL =
  /[=+*/^_<>]|\\begin\{(?:aligned|align|alignat|gathered|gather|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|array|split|smallmatrix|subequations)\*?\}|\\[A-Za-z]*(?:frac|sqrt|sum|prod|int|oint|lim|nabla|partial|pm|infty|mathbb|mathcal|mathfrak|binom|underbrace|overbrace|cfrac|pmod|quad|qquad|hbar)\b/;

function stripMathGroups(source: string): string {
  let previous: string;
  let next = source;
  do {
    previous = next;
    next = previous.replace(/\{[^{}]*\}/g, ' ');
  } while (next !== previous);
  return next;
}

export function matchBareLatex(line: string): string | null {
  const tex = line.trim();
  if (!tex || tex.length > MAX_MATH_LENGTH) return null;
  if (tex.includes('`') || tex.includes('$')) return null;
  if (!/\\[A-Za-z]+/.test(tex)) return null;
  if (!BARE_MATH_SIGNAL.test(tex)) return null;
  if (isLatexDocument(tex)) return null;
  if (/\|\||\*\*|__|~~/.test(tex)) return null;

  let residual = tex
    .replace(/\\[A-Za-z]+\*?/g, ' ')
    .replace(/\\\\/g, ' ')
    .replace(/\\[{}%$&#_]/g, ' ');
  residual = stripMathGroups(residual);
  if (!residual.trim()) return tex;
  if (/[A-Za-z]{2,}/.test(residual)) return null;
  if (!/^[\s0-9A-Za-z=+\-*/^_&|<>()[\].,:;!?'"~\\{}]+$/.test(residual)) return null;
  return tex;
}

const NUMBERED_ENV = /(\\(?:begin|end)\{)(alignat|align|gather|equation)(\})/g;

export function normalizeNumberedEnvironments(source: string): string {
  return source.replace(NUMBERED_ENV, '$1$2*$3');
}

function normalizeLatex(tex: string): string {
  const document = tex.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  const source = document ? document[1]!.trim() : tex;
  return normalizeNumberedEnvironments(source);
}

let katexModule: typeof import('katex') | null = null;
let katexLoading: Promise<typeof import('katex')> | null = null;

export function katexIfLoaded(): typeof import('katex') | null {
  return katexModule;
}

export function loadKatex(): Promise<typeof import('katex')> {
  if (katexModule) return Promise.resolve(katexModule);
  if (!katexLoading) {
    katexLoading = import('katex')
      .then((mod) => {
        const resolved = ((mod as unknown as { default?: typeof import('katex') }).default ?? mod) as typeof import('katex');
        katexModule = resolved;
        return resolved;
      })
      .catch((err) => {
        katexLoading = null;
        throw err;
      });
  }
  return katexLoading;
}

export interface LatexRenderResult {
  html: string;
  error?: string;
}

const RENDER_CACHE_LIMIT = 500;
const renderCache = new Map<string, LatexRenderResult>();

export function renderLatex(tex: string, display: boolean): LatexRenderResult | null {
  const katex = katexModule;
  if (!katex) return null;
  const source = normalizeLatex(tex);
  const key = `${display ? 'D' : 'I'}\u0000${source}`;
  const cached = renderCache.get(key);
  if (cached) return cached;

  const options: KatexOptions = {
    displayMode: display,
    throwOnError: false,
    strict: false,
    trust: false,
    output: 'htmlAndMathml',
    maxSize: 20,
    maxExpand: 1000,
    globalGroup: true,
  };
  let result: LatexRenderResult;
  try {
    katex.renderToString(source, { ...options, throwOnError: true });
    result = { html: katex.renderToString(source, options) };
  } catch (err) {
    result = {
      html: katex.renderToString(source, options),
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (renderCache.size >= RENDER_CACHE_LIMIT) {
    const oldest = renderCache.keys().next().value;
    if (oldest) renderCache.delete(oldest);
  }
  renderCache.set(key, result);
  return result;
}
