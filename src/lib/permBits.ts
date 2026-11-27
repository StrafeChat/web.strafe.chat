/**
 * Permission masks past bit 30.
 *
 * A mask is held as a plain `number`: every permission bit is below 2^53, where a JS number is
 * an exact integer, so masks compare with `===`, sit in stores and survive JSON. What a number
 * cannot do is go through `&`, `|`, `~` or `<<`: those are 32-bit signed operators, so bit 31
 * comes out as the sign (a negative mask) and every bit from 32 up is silently dropped -
 * `1 << 32` is 1, View Room. So every operation on a mask goes through BigInt here, and nothing
 * outside this file applies a bitwise operator to a permission (`npm run check:perm-bits`).
 *
 * On the wire the server reads a permission written as a decimal string as the full value and a
 * JSON number as the legacy 31-bit form (it keeps the stored bits from 31 up), so writes always
 * go out through `toWire` as strings. Reads accept both: the server sends numbers today, and a
 * string is read the same way.
 *
 * This module imports nothing, so the check script can load it under Node directly.
 */

/** The highest bit a mask may use: 2^53 - 1 is the largest exact JS integer. */
export const MAX_PERM_BIT = 52;
const PERM_LIMIT = 2n ** 53n;

/** Anything a permission value can arrive as. */
export type PermInput = number | string | bigint | null | undefined;

/** A permission value as it arrives over the wire: the server sends JSON numbers today (exact
 * below 2^53) and may send decimal strings; read it with `parsePerm`. */
export type PermWire = number | string;

/** Bit `n` as a mask: 2^n (never `1 << n`, which wraps at 31 and aliases at 32). */
export function permBit(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > MAX_PERM_BIT) throw new RangeError(`permission bit ${n} out of range`);
  return 2 ** n;
}

/** A value as a non-negative BigInt below 2^53. A negative number is a 32-bit mask an old client
 * produced with `|` (bit 31 turned into the sign) and reads as those 32 bits; anything else that
 * is not a whole non-negative number reads as no permissions. */
function big(v: PermInput): bigint {
  if (v === null || v === undefined) return 0n;
  if (typeof v === 'bigint') return v < 0n ? BigInt.asUintN(32, v) : BigInt.asUintN(53, v);
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || !Number.isInteger(v)) return 0n;
    if (v < 0) return v >= -(2 ** 31) ? BigInt.asUintN(32, BigInt(v)) : 0n;
    return v < 2 ** 53 ? BigInt(v) : 0n;
  }
  const s = v.trim();
  if (!/^\d{1,20}$/.test(s)) return 0n;
  const b = BigInt(s);
  return b < PERM_LIMIT ? b : 0n;
}

function num(b: bigint): number {
  return Number(BigInt.asUintN(53, b));
}

/** A permission value from the server (number or decimal string) as a mask. Never throws. */
export function parsePerm(v: unknown): number {
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint') return num(big(v));
  return 0;
}

/** The form every permission write sends: a decimal string (the server's full-value form). */
export function toWire(mask: PermInput): string {
  return big(mask).toString();
}

/** Every bit of `bits` is set in `mask`. */
export function hasPerm(mask: PermInput, bits: PermInput): boolean {
  const b = big(bits);
  return (big(mask) & b) === b;
}

/** At least one bit of `bits` is set in `mask`. */
export function hasAnyPerm(mask: PermInput, bits: PermInput): boolean {
  return (big(mask) & big(bits)) !== 0n;
}

/** The union of masks. */
export function orPerms(...masks: PermInput[]): number {
  let out = 0n;
  for (const m of masks) out |= big(m);
  return num(out);
}

/** The intersection of two masks. */
export function andPerms(a: PermInput, b: PermInput): number {
  return num(big(a) & big(b));
}

/** `mask` with every bit of `bits` cleared. */
export function withoutPerms(mask: PermInput, ...bits: PermInput[]): number {
  let out = big(mask);
  for (const b of bits) out &= ~big(b);
  return num(out);
}

/** `mask` with `bit` set or cleared. Never negative, whatever the bit. */
export function togglePerm(mask: PermInput, bit: PermInput, on: boolean): number {
  return on ? orPerms(mask, bit) : withoutPerms(mask, bit);
}

/** One Discord-style overwrite: deny first, then allow. */
export function applyOverwrite(perms: PermInput, allow: PermInput, deny: PermInput): number {
  return num((big(perms) & ~big(deny)) | big(allow));
}

/** An overwrite stack, in order (permissions.ApplyOverwrites). */
export function applyRoomOverwrites(base: PermInput, overwrites: { allow: PermInput; deny: PermInput }[]): number {
  let p = num(big(base));
  for (const o of overwrites) p = applyOverwrite(p, o.allow, o.deny);
  return p;
}

/** The bit positions set in a mask, lowest first. */
export function permBitsOf(mask: PermInput): number[] {
  const out: number[] = [];
  for (let i = 0; i <= MAX_PERM_BIT; i++) if (hasPerm(mask, permBit(i))) out.push(i);
  return out;
}
