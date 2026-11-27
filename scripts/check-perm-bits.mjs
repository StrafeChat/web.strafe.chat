#!/usr/bin/env node
/**
 * Permission masks past bit 30 (src/lib/permBits.ts). Run: npm run check:perm-bits
 *
 * 1. Static: JS's `&`, `|`, `^`, `~`, `<<`, `>>`, `>>>` are 32-bit signed operators - bit 31 comes
 *    out as the sign and every bit from 32 up is dropped (`1 << 32` is 1, View Room). So no file
 *    in src/ may apply one to a permission: a `Perm*` constant exported by spacePermissions.ts, a
 *    `.permissions` / `.allow` / `.deny` / `grantable_permissions` field, or one of the mask
 *    signals the editors keep. permBits.ts is the one exception (it works in BigInt), and
 *    neither it nor spacePermissions.ts may contain `<<` at all.
 * 2. Runtime: permBits itself (bits 31, 32 and 52, toggles never negative, wire strings, legacy
 *    numbers), and the role/override matrix in spacePermissionsMatrix.ts, bundled with esbuild
 *    (Vite's own dependency) with the i18n module stubbed out.
 *
 * Comments and string literals are blanked before the scan, so prose about `1 << 31` is fine.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const PERM_BITS = join(SRC, 'lib', 'permBits.ts');
const SPACE_PERMS = join(SRC, 'lib', 'spacePermissions.ts');

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`FAIL ${msg}`);
};

// ---- static scan ---------------------------------------------------------------------------

/** Source with comments, strings, template text and regex literals replaced by spaces (line
 * structure kept, so reported line numbers stay right). Template `${…}` bodies are kept. */
function blank(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const tmplDepth = []; // brace depth at which each open template's ${ started
  let braces = 0;
  const keep = (c) => (c === '\n' ? '\n' : ' ');
  let prevSignificant = '';
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '/' && d === '*') {
      out += '  '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += keep(src[i]); i++; }
      out += '  '; i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      out += c; i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\') { out += ' '; i++; }
        out += keep(src[i] ?? ''); i++;
      }
      out += c; i++;
      prevSignificant = c;
      continue;
    }
    if (c === '`' || (c === '}' && tmplDepth.length && tmplDepth[tmplDepth.length - 1] === braces)) {
      if (c === '}') { tmplDepth.pop(); }
      out += c; i++;
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\') { out += ' '; i++; out += keep(src[i] ?? ''); i++; continue; }
        if (src[i] === '$' && src[i + 1] === '{') { out += '${'; i += 2; tmplDepth.push(braces); break; }
        out += keep(src[i]); i++;
      }
      if (src[i] === '`') { out += '`'; i++; }
      prevSignificant = '`';
      continue;
    }
    // A regex literal: `/` where an expression may start.
    if (c === '/' && /[(,=:[!&|?{};+\-*%~^]|^$|return$/.test(prevSignificant)) {
      out += '/'; i++;
      let inClass = false;
      while (i < n && src[i] !== '\n') {
        const r = src[i];
        if (r === '\\') { out += '  '; i += 2; continue; }
        if (r === '[') inClass = true;
        else if (r === ']') inClass = false;
        else if (r === '/' && !inClass) break;
        out += ' '; i++;
      }
      if (src[i] === '/') { out += '/'; i++; }
      while (i < n && /[a-z]/i.test(src[i])) { out += src[i]; i++; }
      prevSignificant = '/x';
      continue;
    }
    if (c === '{') braces++;
    if (c === '}') braces--;
    out += c;
    if (!/\s/.test(c)) {
      // Track the previous token loosely: word chars collapse into the word.
      if (/[\w$]/.test(c)) {
        let j = out.length - 1;
        while (j > 0 && /[\w$]/.test(out[j - 1])) j--;
        prevSignificant = out.slice(j);
      } else prevSignificant = c;
    }
    i++;
  }
  return out;
}

/** Every Perm* / *PermMask constant spacePermissions.ts exports. */
const permConsts = [...readFileSync(SPACE_PERMS, 'utf8').matchAll(/export const ((?:Perm[A-Z]\w*)|(?:\w*PermMask))\b/g)].map((m) => m[1]);
assert.ok(permConsts.includes('PermManageWebhooks') && permConsts.includes('PermMasquerade'), 'spacePermissions.ts lost its Perm* exports');
const PERMISH = new RegExp(
  [
    `\\b(?:${permConsts.join('|')})\\b`,
    String.raw`\.(?:permissions|allow|deny)\b`,
    String.raw`\bgrantable_permissions\b`,
    // the editors' mask signals and locals
    String.raw`\b(?:permMask|allowMask|denyMask|genPerms|granted|grantable|roleAllow|roleDeny)\b`,
  ].join('|')
);

/** The operand right after index `i` (skipping unary `~`/`!`/spaces): a parenthesised group or
 * an identifier chain with an optional call. */
function operandAfter(s, i) {
  let j = i;
  while (j < s.length && /[\s~!]/.test(s[j])) j++;
  if (s[j] === '(') {
    let depth = 0;
    let k = j;
    for (; k < s.length; k++) {
      if (s[k] === '(') depth++;
      else if (s[k] === ')' && --depth === 0) break;
    }
    return s.slice(j, k + 1);
  }
  const m = /^[\w$.?]+(?:\(\))?/.exec(s.slice(j));
  return m ? m[0] : '';
}

/** The operand ending just before index `i`. */
function operandBefore(s, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(s[j])) j--;
  if (s[j] === ')') {
    // `x()` - a call: take the callee; `( … )` - a group: take it whole.
    if (s[j - 1] === '(') {
      let k = j - 2;
      while (k >= 0 && /[\w$.?]/.test(s[k])) k--;
      return s.slice(k + 1, j + 1);
    }
    let depth = 0;
    let k = j;
    for (; k >= 0; k--) {
      if (s[k] === ')') depth++;
      else if (s[k] === '(' && --depth === 0) break;
    }
    return s.slice(k, j + 1);
  }
  let k = j;
  while (k >= 0 && /[\w$.?]/.test(s[k])) k--;
  return s.slice(k + 1, j + 1);
}

// `a & b`, `a | b`, `a ^ b`, `a << b`, `a >> b`, `a >>> b`, compound forms, and unary `~a`.
// `&&`, `||`, `??`, `=>`, `>=`, `<=`, TS generics and JSX are not bitwise and are skipped.
const BINARY = /<<=?|>>>=?|>>=?|(?<![&|])[&|^]=?(?![&|])/g;

/** In a file that imports the permission modules, these generic local names are masks too
 * (`setAllowMask((prev) => prev | bit)`). */
const LOCAL_MASK = /\b(?:bit|bits|mask|prev|cur|perms|base)\b/;

/** Every bitwise operator applied to a permission in already-blanked source. */
function hits(s, permFile = false) {
  const out = [];
  const isPerm = (x) => PERMISH.test(x) || (permFile && LOCAL_MASK.test(x));
  for (const m of s.matchAll(BINARY)) {
    const left = operandBefore(s, m.index);
    const right = operandAfter(s, m.index + m[0].length);
    // TS union/intersection types (`A | B`) have type names as operands, which never match
    // PERMISH (the Perm* consts are values), so they need no special case.
    if (isPerm(left) || isPerm(right)) out.push({ at: m.index, text: `${left.trim()} ${m[0]} ${right.trim()}` });
  }
  for (const m of s.matchAll(/~/g)) {
    const right = operandAfter(s, m.index + 1);
    if (isPerm(right)) out.push({ at: m.index, text: `~${right.trim()}` });
  }
  return out;
}

function scanFile(path) {
  const rel = relative(ROOT, path);
  const raw = readFileSync(path, 'utf8');
  const s = blank(raw);
  const permFile = /from '[./]*(?:lib\/)?(?:spacePermissions|permBits)'/.test(raw);
  const lineOf = (idx) => s.slice(0, idx).split('\n').length;
  if ((path === PERM_BITS || path === SPACE_PERMS) && /<</.test(s)) {
    fail(`${rel}:${lineOf(s.indexOf('<<'))}: \`<<\` in a permission module (use permBit(n), i.e. 2 ** n)`);
  }
  if (path === PERM_BITS) return;
  for (const h of hits(s, permFile)) fail(`${rel}:${lineOf(h.at)}: bitwise operator on a permission (\`${h.text}\`) - use permBits`);
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name) && !p.includes(join('i18n', 'locales'))) scanFile(p);
  }
}
walk(SRC);

// The scanner itself: it must catch the classic mistakes, so a regex change that silently stops
// matching fails here instead of letting a regression through.
{
  const caught = [
    'const x = mask & PermManageWebhooks;',
    'const y = (role.permissions | PermViewChannel);',
    'p = (p & ~o.deny) | o.allow;',
    'setAllowMask((prev) => prev & ~bit) || allowMask() | 4;',
    'const z = (existing?.allow ?? 0) & ~PermViewChannel;',
    'const w = 1 << 31 | PermSendMessages;',
    'base |= r.permissions;',
  ];
  const caughtInPermFile = ['setAllowMask((prev) => (on ? prev | bit : prev & ~bit));'];
  const clean = [
    "const s = '1 << 31 & PermViewChannel';",
    '// mask & PermViewChannel',
    'const a = hasPerm(mask, PermViewChannel) && ok || other;',
    'type T = PermRow | undefined;',
    'const flags = msg.flags & 4;',
    'const re = /<@&(\\d+)>/g; const q = PermViewChannel;',
    'const t = `${a | b} PermViewChannel & x`;',
  ];
  for (const c of caught) if (hits(blank(c)).length === 0) fail(`scanner self-test missed \`${c}\``);
  for (const c of caughtInPermFile) if (hits(blank(c), true).length === 0) fail(`scanner self-test missed \`${c}\``);
  for (const c of clean) if (hits(blank(c)).length > 0) fail(`scanner self-test false positive on \`${c}\``);
}

// ---- runtime: permBits ---------------------------------------------------------------------

const pb = await import(pathToFileURL(PERM_BITS).href);
const check = (name, fn) => {
  try {
    fn();
  } catch (err) {
    fail(`${name}\n${err.message}`);
  }
};
const B31 = 2 ** 31;
const B32 = 2 ** 32;
const B52 = 2 ** 52;

check('permBit is 2^n, never wraps', () => {
  assert.equal(pb.permBit(0), 1);
  assert.equal(pb.permBit(31), B31);
  assert.equal(pb.permBit(32), B32);
  assert.equal(pb.permBit(52), B52);
  assert.throws(() => pb.permBit(53));
  assert.throws(() => pb.permBit(-1));
});
check('hasPerm on bits 31, 32, 52', () => {
  const m = pb.orPerms(1, B31, B32, B52);
  assert.equal(m, 1 + B31 + B32 + B52);
  for (const b of [1, B31, B32, B52]) assert.ok(pb.hasPerm(m, b), `bit ${Math.log2(b)}`);
  assert.ok(!pb.hasPerm(B31, 1), 'bit 31 must not read as bit 0');
  assert.ok(!pb.hasPerm(B32, 1), 'bit 32 must not alias View Room');
  assert.ok(!pb.hasPerm(1, B32));
  assert.ok(pb.hasAnyPerm(m, pb.orPerms(2, B32)));
  assert.ok(!pb.hasAnyPerm(1, pb.orPerms(2, B32)));
});
check('togglePerm never goes negative and keeps high bits', () => {
  let m = 0;
  m = pb.togglePerm(m, B31, true);
  assert.equal(m, B31);
  m = pb.togglePerm(m, B32, true);
  assert.equal(m, B31 + B32);
  m = pb.togglePerm(m, B52, true);
  m = pb.togglePerm(m, B31, false);
  assert.equal(m, B32 + B52);
  assert.ok(m >= 0);
  m = pb.togglePerm(m, 1, true);
  m = pb.togglePerm(m, 1, false);
  assert.equal(m, B32 + B52);
});
check('toWire writes decimal strings', () => {
  assert.equal(pb.toWire(0), '0');
  assert.equal(pb.toWire(B31), '2147483648');
  assert.equal(pb.toWire(pb.orPerms(B31, B32)), '6442450944');
  assert.equal(pb.toWire(B52), '4503599627370496');
  assert.equal(pb.toWire('6442450944'), '6442450944');
});
check('reads: numbers, strings, legacy negatives, junk', () => {
  assert.equal(pb.parsePerm(6442450944), 6442450944);
  assert.equal(pb.parsePerm('6442450944'), 6442450944);
  assert.equal(pb.parsePerm(' 3 '), 3);
  // A 32-bit mask an old client wrote with `|` (bit 31 as the sign) reads as its 32 bits.
  assert.equal(pb.parsePerm(-2147483648), B31);
  assert.equal(pb.parsePerm(-2147483647), B31 + 1);
  assert.equal(pb.parsePerm('-1'), 0);
  assert.equal(pb.parsePerm('abc'), 0);
  assert.equal(pb.parsePerm(1.5), 0);
  assert.equal(pb.parsePerm(null), 0);
  assert.equal(pb.parsePerm({}), 0);
  assert.equal(pb.parsePerm(String(2 ** 53)), 0);
  assert.ok(pb.hasPerm('6442450944', B32));
});
check('overwrites: deny then allow, high bits', () => {
  const base = pb.orPerms(1, 2, B31, B32);
  assert.equal(pb.applyOverwrite(base, 0, B32), pb.orPerms(1, 2, B31));
  assert.equal(pb.applyOverwrite(base, B52, pb.orPerms(2, B31)), pb.orPerms(1, B32, B52));
  assert.equal(
    pb.applyRoomOverwrites(base, [
      { allow: 0, deny: '6442450944' },
      { allow: String(B32), deny: 0 },
    ]),
    pb.orPerms(1, 2, B32)
  );
  assert.equal(pb.withoutPerms(base, 1, B32), pb.orPerms(2, B31));
  assert.equal(pb.andPerms(base, pb.orPerms(2, B32, 4)), pb.orPerms(2, B32));
  assert.deepEqual(pb.permBitsOf(pb.orPerms(1, B31, B32, B52)), [0, 31, 32, 52]);
});

// ---- runtime: the role/override matrix -------------------------------------------------------

let esbuild;
try {
  esbuild = await import('esbuild');
} catch {
  fail('esbuild (a Vite dependency) is not installed - run npm install');
}
if (esbuild) {
  const result = await esbuild.build({
    entryPoints: [join(SRC, 'lib', 'spacePermissionsMatrix.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
    plugins: [
      {
        name: 'stub-i18n',
        setup(b) {
          b.onResolve({ filter: /\/i18n$/ }, () => ({ path: 'i18n-stub', namespace: 'stub' }));
          b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const t = (k) => k;', loader: 'js' }));
        },
      },
    ],
  });
  const code = result.outputFiles[0].text;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  for (const r of mod.evaluatePermissionMatrix()) {
    if (!r.pass) fail(`matrix: ${r.name}`);
  }
}

if (failures) {
  console.error(`\n${failures} permission-bit check(s) failed`);
  process.exit(1);
}
console.log('perm bits: ok (static scan, permBits, matrix)');
