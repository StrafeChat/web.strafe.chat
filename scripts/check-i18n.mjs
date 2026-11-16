#!/usr/bin/env node
/**
 * i18n parity: the six locale files must define the same keys as `en` (plural forms aside -
 * en/de have _one/_other, es/fr/pt-BR add _many, ar has all six CLDR forms), and every
 * literal `t('…')` key used in src must exist in `en`. Run: npm run check:i18n
 *
 * No dependencies: Node (>= 23.6) strips the types from the .ts locale files itself, and they
 * are plain default-exported objects. Template-string keys (t(`…${x}`)) are skipped.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const LOCALE_DIR = join(SRC, 'i18n', 'locales');
const LOCALES = ['en', 'es', 'fr', 'de', 'pt-BR', 'ar'];
const PLURAL = /_(zero|one|two|few|many|other)$/;

function flatten(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, path, out);
    else out.push(path);
  }
  return out;
}

async function load(code) {
  const mod = await import(pathToFileURL(join(LOCALE_DIR, `${code}.ts`)).href);
  return mod.default;
}

const base = (k) => k.replace(PLURAL, '');
const sets = {};
for (const code of LOCALES) sets[code] = new Set(flatten(await load(code)).map(base));

let failed = false;
for (const code of LOCALES) {
  if (code === 'en') continue;
  for (const k of sets.en) if (!sets[code].has(k)) { console.error(`${code}: missing ${k}`); failed = true; }
  for (const k of sets[code]) if (!sets.en.has(k)) { console.error(`${code}: extra ${k} (not in en)`); failed = true; }
}

// Every object path in en too, so t('a.b', { returnObjects: true }) on a block counts.
const enPrefixes = new Set();
for (const k of sets.en) {
  const parts = k.split('.');
  for (let i = 1; i < parts.length; i++) enPrefixes.add(parts.slice(0, i).join('.'));
}

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (p === LOCALE_DIR) continue;
    if (statSync(p).isDirectory()) yield* sourceFiles(p);
    else if (/\.tsx?$/.test(name)) yield p;
  }
}

// t('a.b') / t("a.b"), the quote closed and followed by ")" or "," - so t('a.' + x) is skipped.
const CALL = /\bt\(\s*(['"])([A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)+)\1\s*[,)]/g;
let used = 0;
for (const file of sourceFiles(SRC)) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(CALL)) {
    const key = m[2];
    used++;
    const k = base(key);
    if (!sets.en.has(k) && !enPrefixes.has(k)) {
      const line = text.slice(0, m.index).split('\n').length;
      console.error(`${relative(ROOT, file)}:${line}: t('${key}') is not in en`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`i18n ok: ${sets.en.size} keys in ${LOCALES.length} locales, ${used} literal t() keys found in en`);
