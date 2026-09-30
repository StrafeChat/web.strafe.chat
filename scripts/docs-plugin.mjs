// The developer documentation site, served by every instance at /docs/.
//
// Source is plain Markdown in docs/pages/*.md (numbered for order, a small front matter
// block for title/description/slug), rendered with `marked` into docs/template.html and
// styled by docs/theme.css + docs/docs.js. This module is both a Vite plugin - in dev the
// pages are rendered on request under /docs/, and `vite build` emits them into dist/docs/
// so the web image serves them with the client - and a CLI (`npm run docs:build`) that
// writes the same files to a directory.
//
// Nothing here is bundled into the app: the docs are separate static pages with their own
// (strict) CSP, no framework and no third-party assets.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_DIR = join(ROOT, 'docs');
const PAGES_DIR = join(DOCS_DIR, 'pages');
const BASE = '/docs/';

// ---- markdown ---------------------------------------------------------------------------

function parseFrontMatter(src) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: src.slice(m[0].length) };
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// A small regex highlighter: enough for the JSON, shell, JavaScript, Python, Go and HTTP
// snippets the docs use, with no dependency. Input is already HTML-escaped.
const LANG_RULES = {
  json: [
    ['key', /"(?:\\.|[^"\\])*"(?=\s*:)/],
    ['str', /"(?:\\.|[^"\\])*"/],
    ['num', /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/],
    ['kw', /\b(?:true|false|null)\b/],
  ],
  js: [
    ['cmt', /\/\/[^\n]*|\/\*[\s\S]*?\*\//],
    ['str', /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/],
    ['num', /\b\d+(?:\.\d+)?\b/],
    ['kw', /\b(?:const|let|var|function|return|await|async|import|from|export|if|else|for|of|in|new|class|try|catch|throw|true|false|null|undefined|switch|case|break|default|typeof|while)\b/],
  ],
  python: [
    ['cmt', /#[^\n]*/],
    ['str', /"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/],
    ['num', /\b\d+(?:\.\d+)?\b/],
    ['kw', /\b(?:def|return|import|from|if|elif|else|for|in|while|with|as|async|await|True|False|None|class|try|except|raise|not|and|or|is|lambda|print)\b/],
  ],
  go: [
    ['cmt', /\/\/[^\n]*|\/\*[\s\S]*?\*\//],
    ['str', /`[^`]*`|"(?:\\.|[^"\\])*"/],
    ['num', /\b\d+(?:\.\d+)?\b/],
    ['kw', /\b(?:package|import|func|return|var|const|type|struct|interface|if|else|for|range|go|defer|select|case|switch|default|map|chan|nil|true|false|err|string|int|int64|bool|error)\b/],
  ],
  bash: [
    ['cmt', /(?:^|\s)#[^\n]*/],
    ['str', /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/],
    ['kw', /\b(?:curl|export|echo|node|python3|npm|pip|git|cd|cat)\b/],
    ['flag', /(?:^|\s)(?:--?[a-zA-Z][\w-]*)/],
  ],
  http: [
    ['kw', /^(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/m],
    ['key', /^[A-Za-z-]+(?=:)/m],
    ['str', /"(?:\\.|[^"\\])*"/],
    ['num', /\b\d{3}\b/],
  ],
};
LANG_RULES.javascript = LANG_RULES.js;
LANG_RULES.ts = LANG_RULES.js;
LANG_RULES.typescript = LANG_RULES.js;
LANG_RULES.sh = LANG_RULES.bash;
LANG_RULES.shell = LANG_RULES.bash;
LANG_RULES.py = LANG_RULES.python;

function highlight(escaped, lang) {
  const rules = LANG_RULES[lang];
  if (!rules) return escaped;
  const combined = new RegExp(rules.map(([cls, re]) => `(${re.source})`).join('|'), 'gm');
  return escaped.replace(combined, (match, ...groups) => {
    const idx = groups.findIndex((g, i) => i < rules.length && g !== undefined);
    const cls = idx >= 0 ? rules[idx][0] : '';
    return cls ? `<span class="tok-${cls}">${match}</span>` : match;
  });
}

function createRenderer(toc) {
  return {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = slugify(text);
      if (depth === 2 || depth === 3) toc.push({ id, text: text.replace(/<[^>]+>/g, ''), depth });
      // The page title gets no anchor link; sections do.
      const anchor = depth === 1 ? '' : `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>`;
      return `<h${depth} id="${id}">${text}${anchor}</h${depth}>\n`;
    },
    code({ text, lang }) {
      const language = (lang || '').split(/\s+/)[0].toLowerCase();
      const label = language || 'text';
      return (
        `<div class="code"><div class="code-head"><span>${escapeHtml(label)}</span>` +
        `<button type="button" class="copy" aria-label="Copy code">Copy</button></div>` +
        `<pre><code class="lang-${escapeHtml(label)}">${highlight(escapeHtml(text), language)}</code></pre></div>\n`
      );
    },
    table({ header, rows }) {
      const cell = (c, tag) => {
        const align = c.align ? ` style="text-align:${c.align}"` : '';
        return `<${tag}${align}>${this.parser.parseInline(c.tokens)}</${tag}>`;
      };
      const head = `<thead><tr>${header.map((c) => cell(c, 'th')).join('')}</tr></thead>`;
      const body = rows.map((r) => `<tr>${r.map((c) => cell(c, 'td')).join('')}</tr>`).join('');
      return `<div class="table-wrap"><table>${head}<tbody>${body}</tbody></table></div>\n`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const external = /^https?:\/\//.test(href);
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      const rel = external ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${escapeHtml(href)}"${t}${rel}>${text}</a>`;
    },
    blockquote({ tokens }) {
      // GitHub-style callouts: a quote whose first line is [!NOTE] / [!TIP] / [!WARNING].
      const body = this.parser.parse(tokens);
      const m = /^<p>\[!(NOTE|TIP|WARNING|IMPORTANT)\]\s*(?:<br>)?\s*/i.exec(body);
      if (!m) return `<blockquote>${body}</blockquote>\n`;
      const kind = m[1].toLowerCase();
      const label = { note: 'Note', tip: 'Tip', warning: 'Warning', important: 'Important' }[kind];
      return `<aside class="callout ${kind}"><div class="callout-title">${label}</div>${body.replace(m[0], '<p>')}</aside>\n`;
    },
  };
}

function renderMarkdown(body) {
  const toc = [];
  const instance = new Marked({ gfm: true, renderer: createRenderer(toc) });
  const html = instance.parse(body);
  return { html, toc };
}

function plainText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- site -------------------------------------------------------------------------------

function loadPages() {
  const files = readdirSync(PAGES_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();
  return files.map((file) => {
    const { meta, body } = parseFrontMatter(readFileSync(join(PAGES_DIR, file), 'utf8'));
    const slug = meta.slug !== undefined ? meta.slug : file.replace(/^\d+-/, '').replace(/\.md$/, '');
    const { html, toc } = renderMarkdown(body);
    return {
      file,
      slug: slug === 'index' ? '' : slug,
      title: meta.title || slug || 'Docs',
      description: meta.description || '',
      html,
      toc,
      text: plainText(html),
    };
  });
}

function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : ''));
}

function navHtml(pages, current) {
  return pages
    .map((p) => {
      const href = BASE + (p.slug ? p.slug + '/' : '');
      const active = p.slug === current.slug ? ' class="active" aria-current="page"' : '';
      return `<li><a href="${href}"${active}>${escapeHtml(p.title)}</a></li>`;
    })
    .join('');
}

function tocHtml(page) {
  if (page.toc.length === 0) return '';
  const items = page.toc
    .map((h) => `<li class="d${h.depth}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`)
    .join('');
  return `<nav class="toc" aria-label="On this page"><div class="toc-title">On this page</div><ul>${items}</ul></nav>`;
}

/** Renders every output file: path (relative to the site root) -> string. */
export function buildDocs() {
  const template = readFileSync(join(DOCS_DIR, 'template.html'), 'utf8');
  const pages = loadPages();
  const out = new Map();
  for (const page of pages) {
    const idx = pages.indexOf(page);
    const prev = pages[idx - 1];
    const next = pages[idx + 1];
    const pager =
      (prev ? `<a class="pager-prev" href="${BASE}${prev.slug ? prev.slug + '/' : ''}"><small>Previous</small>${escapeHtml(prev.title)}</a>` : '<span></span>') +
      (next ? `<a class="pager-next" href="${BASE}${next.slug ? next.slug + '/' : ''}"><small>Next</small>${escapeHtml(next.title)}</a>` : '<span></span>');
    const html = fill(template, {
      title: escapeHtml(page.title),
      description: escapeHtml(page.description),
      base: BASE,
      nav: navHtml(pages, page),
      toc: tocHtml(page),
      content: page.html,
      pager,
    });
    out.set(`docs/${page.slug ? page.slug + '/' : ''}index.html`, html);
  }
  out.set(
    'docs/search.json',
    JSON.stringify(
      pages.map((p) => ({
        url: BASE + (p.slug ? p.slug + '/' : ''),
        title: p.title,
        description: p.description,
        headings: p.toc.map((h) => ({ id: h.id, text: h.text })),
        text: p.text.slice(0, 4000),
      })),
    ),
  );
  out.set('docs/assets/docs.css', readFileSync(join(DOCS_DIR, 'theme.css'), 'utf8'));
  out.set('docs/assets/docs.js', readFileSync(join(DOCS_DIR, 'docs.js'), 'utf8'));
  return out;
}

const MIME = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', json: 'application/json; charset=utf-8' };

/** Vite plugin: /docs/ in dev, dist/docs/ in the build. */
export function strafeDocsPlugin() {
  return {
    name: 'strafe-docs',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url === '/docs') {
          res.statusCode = 302;
          res.setHeader('Location', BASE);
          res.end();
          return;
        }
        if (!url.startsWith(BASE)) return next();
        let files;
        try {
          files = buildDocs();
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end(`docs build failed: ${err && err.stack ? err.stack : err}`);
          return;
        }
        let key = url.slice(1);
        if (key.endsWith('/')) key += 'index.html';
        else if (!/\.[a-z0-9]+$/i.test(key)) {
          // /docs/oauth2 -> /docs/oauth2/ so relative links and the nginx build agree.
          res.statusCode = 302;
          res.setHeader('Location', url + '/');
          res.end();
          return;
        }
        const body = files.get(key);
        if (body === undefined) return next();
        const ext = key.split('.').pop();
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        res.end(body);
      });
    },
    generateBundle() {
      for (const [fileName, source] of buildDocs()) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
  };
}

// CLI: node scripts/docs-plugin.mjs [outDir]  (default dist)
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = resolve(process.argv[2] || 'dist');
  const files = buildDocs();
  for (const [name, content] of files) {
    const path = join(outDir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  console.log(`docs: wrote ${files.size} files to ${outDir}/docs`);
}
