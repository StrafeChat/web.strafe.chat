#!/usr/bin/env node
/**
 * Checks the default-avatar rule (src/lib/defaultAvatar.ts) and the images it points at.
 * Run: npm run check:default-avatar
 *
 * No dependencies: Node (>= 23.6) strips the types from the .ts module itself.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_AVATAR_COUNT,
  defaultAvatarHomeId,
  defaultAvatarIndex,
  defaultAvatarUrl,
} from '../src/lib/defaultAvatar.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`FAIL ${name}\n${err.message}`);
    process.exitCode = 1;
  }
};

check('count is fixed at 8', () => assert.equal(DEFAULT_AVATAR_COUNT, 8));

check('index is (id >> 22) % 8', () => {
  for (let i = 0n; i < 16n; i++) {
    const id = (i << 22n) | 0x3fffffn; // the low 22 bits never matter
    assert.equal(defaultAvatarIndex(String(id)), Number(i % 8n));
    assert.equal(defaultAvatarIndex({ id: String(id) }), Number(i % 8n));
  }
  // Real-sized snowflakes, worked out independently: (n >> 22) % 8.
  assert.equal(defaultAvatarIndex('1234567890123456789'), 7);
  assert.equal(defaultAvatarIndex('190000000000000000'), 5);
});

check('ids past 2^53 keep their precision', () => {
  // 2^62 + (3 << 22): as a JS number the low bits would round away.
  const id = (1n << 62n) + (3n << 22n);
  assert.equal(defaultAvatarIndex(String(id)), 3);
  assert.equal(defaultAvatarIndex(id), 3);
});

check('bigint and safe-integer number ids', () => {
  assert.equal(defaultAvatarIndex(6n << 22n), 6);
  assert.equal(defaultAvatarIndex({ id: 2n << 22n }), 2);
  assert.equal(defaultAvatarIndex(Number(4n << 22n)), 4);
});

check('a federated user uses their home (origin) id', () => {
  const local = String(1n << 22n); // this instance's shadow row -> 1
  const home = String(6n << 22n); // what their home instance calls them -> 6
  assert.equal(defaultAvatarIndex({ id: local, origin_id: home }), 6);
  assert.equal(defaultAvatarHomeId({ id: local, origin_id: home }), 6n << 22n);
  // An unusable origin_id falls back to the id.
  assert.equal(defaultAvatarIndex({ id: local, origin_id: '' }), 1);
  assert.equal(defaultAvatarIndex({ id: local, origin_id: null }), 1);
  assert.equal(defaultAvatarIndex({ id: local, origin_id: 'nope' }), 1);
});

check('missing or invalid ids fall back to 0', () => {
  for (const v of [undefined, null, '', ' ', 'abc', '12a', '-5', '1.5', -1, 1.5, Number.MAX_VALUE, -1n, {}, { id: null }, { id: 'x' }]) {
    assert.equal(defaultAvatarIndex(v), 0, `input ${String(v)}`);
  }
});

check('a deleted user keeps the default from their id', () => {
  // A deleted placeholder still carries the id; nothing else about it matters.
  assert.equal(defaultAvatarIndex({ id: String(5n << 22n), deleted: true, username: '' }), 5);
});

check('urls', () => {
  assert.equal(defaultAvatarUrl(String(3n << 22n)), '/avatars/default/3.png');
  assert.equal(defaultAvatarUrl(null), '/avatars/default/0.png');
  assert.equal(defaultAvatarUrl(String(3n << 22n), 'https://app.strafe.chat'), 'https://app.strafe.chat/avatars/default/3.png');
  assert.equal(defaultAvatarUrl(String(3n << 22n), 'https://app.strafe.chat/'), 'https://app.strafe.chat/avatars/default/3.png');
});

check('every index has a 256x256 PNG in public/', () => {
  for (let i = 0; i < DEFAULT_AVATAR_COUNT; i++) {
    const buf = readFileSync(`${ROOT}public/avatars/default/${i}.png`);
    assert.equal(buf.subarray(1, 4).toString('latin1'), 'PNG', `${i}.png is not a PNG`);
    assert.equal(buf.readUInt32BE(16), 256, `${i}.png width`);
    assert.equal(buf.readUInt32BE(20), 256, `${i}.png height`);
  }
});

if (process.exitCode) console.error('default avatars: FAILED');
else console.log(`default avatars ok: ${passed} checks`);
