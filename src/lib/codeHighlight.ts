import DOMPurify from 'dompurify';
import type { HLJSApi } from 'highlight.js';

/**
 * Syntax highlighting for message code blocks, the way Discord does it: only when the
 * author named a language, never guessed.
 *
 * highlight.js and its grammars are a few hundred kilobytes, which has no business in the
 * bundle that renders the login screen - so the engine and the languages are imported on
 * demand, the first time a message with a fenced block is actually shown, and the result is
 * cached per (language, source) because the same message re-renders constantly.
 */

/** The languages worth carrying. Each grammar is its own chunk, fetched only when a message
 * that uses it is actually shown - a ```js block costs the engine plus javascript, not all
 * twenty-seven. */
const LANGUAGES: Record<string, () => Promise<{ default: unknown }>> = {
  bash: () => import('highlight.js/lib/languages/bash'),
  c: () => import('highlight.js/lib/languages/c'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  css: () => import('highlight.js/lib/languages/css'),
  diff: () => import('highlight.js/lib/languages/diff'),
  dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
  go: () => import('highlight.js/lib/languages/go'),
  graphql: () => import('highlight.js/lib/languages/graphql'),
  ini: () => import('highlight.js/lib/languages/ini'),
  java: () => import('highlight.js/lib/languages/java'),
  javascript: () => import('highlight.js/lib/languages/javascript'),
  json: () => import('highlight.js/lib/languages/json'),
  kotlin: () => import('highlight.js/lib/languages/kotlin'),
  lua: () => import('highlight.js/lib/languages/lua'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  php: () => import('highlight.js/lib/languages/php'),
  python: () => import('highlight.js/lib/languages/python'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  rust: () => import('highlight.js/lib/languages/rust'),
  scss: () => import('highlight.js/lib/languages/scss'),
  shell: () => import('highlight.js/lib/languages/shell'),
  sql: () => import('highlight.js/lib/languages/sql'),
  swift: () => import('highlight.js/lib/languages/swift'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  xml: () => import('highlight.js/lib/languages/xml'), // also HTML, Vue, SVG
  yaml: () => import('highlight.js/lib/languages/yaml'),
};

/** What people write after a fence, mapped to the grammar that handles it. The grammars
 * declare their own aliases, but only once loaded - and the whole point is to load just the
 * one a message needs, so the short names have to be resolvable up front. */
const ALIASES: Record<string, string> = {
  'c++': 'cpp', 'c#': 'csharp', cs: 'csharp', console: 'shell', dockerfile: 'dockerfile',
  golang: 'go', htm: 'xml', html: 'xml', js: 'javascript', jsx: 'javascript', kt: 'kotlin',
  md: 'markdown', mjs: 'javascript', patch: 'diff', pl: 'php', py: 'python', rb: 'ruby',
  rs: 'rust', sh: 'bash', shell: 'shell', svg: 'xml', toml: 'ini', ts: 'typescript',
  tsx: 'typescript', vue: 'xml', yml: 'yaml', zsh: 'bash',
};

let enginePromise: Promise<HLJSApi | null> | null = null;
/** One load per language, kept so a second block in the same language does not refetch. */
const loaded = new Map<string, Promise<boolean>>();

/** The engine itself, without a single grammar - those come one at a time, below. */
function engine(): Promise<HLJSApi | null> {
  enginePromise ??= import('highlight.js/lib/core')
    .then((core) => core.default)
    // No highlighting is a fine outcome; the block still renders as plain code.
    .catch(() => null);
  return enginePromise;
}

/** The grammar name for what was written after the fence, or '' when we do not carry it. */
function canonical(raw: string): string {
  const name = raw.trim().toLowerCase();
  if (!name) return '';
  const resolved = ALIASES[name] ?? name;
  return resolved in LANGUAGES ? resolved : '';
}

/** Register one grammar, fetching it the first time it is asked for. */
function ensureLanguage(hljs: HLJSApi, language: string): Promise<boolean> {
  let pending = loaded.get(language);
  if (!pending) {
    pending = LANGUAGES[language]!()
      .then((mod) => {
        const grammar = mod.default as Parameters<HLJSApi['registerLanguage']>[1] | undefined;
        if (!grammar) return false;
        hljs.registerLanguage(language, grammar);
        return true;
      })
      .catch(() => false);
    loaded.set(language, pending);
  }
  return pending;
}

/** Cache keyed by language and source: the same message re-renders on every store change. */
const cache = new Map<string, string>();
const CACHE_MAX = 200;

export interface HighlightedCode {
  /** Sanitised HTML with highlight.js token spans. */
  html: string;
  /** The language actually used, for the label on the block. */
  language: string;
}

/**
 * Highlighted HTML for a code block, or null when the language is unknown (or highlighting
 * failed), in which case the caller renders the code as plain text.
 *
 * highlight.js escapes the source it emits, and the result is run through DOMPurify as
 * well - the same belt-and-braces the bio renderer uses, since this ends up as innerHTML.
 */
export async function highlightCode(code: string, lang: string): Promise<HighlightedCode | null> {
  const language = canonical(lang);
  if (!language || !code) return null;

  const key = language + '\n\u0001\n' + code;
  const hit = cache.get(key);
  if (hit !== undefined) return { html: hit, language };

  const hljs = await engine();
  if (!hljs || !(await ensureLanguage(hljs, language))) return null;

  try {
    const { value } = hljs.highlight(code, { language, ignoreIllegals: true });
    const html = DOMPurify.sanitize(value, { ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['class'] });
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(key, html);
    return { html, language };
  } catch {
    return null;
  }
}
