import type { SpaceRole } from '../api/spaces';

/**
 * Role order as the server defines it (spaces.placeRoles, Discord's rule), and the position
 * writes that reorder roles without touching any the viewer may not move.
 *
 * Pure functions with no store or network, so the web's role list and mobile's RolesScreen
 * (through the web submodule) order and save roles the same way.
 */

const EVERYONE_ROLE_NAME = '@everyone';

/** One entry of PATCH /spaces/:id/roles (Discord's Modify Guild Role Positions). */
export interface RolePosition {
  id: string;
  position: number;
}

/** Snowflake ids compared as the numbers they are: decimal strings without leading zeros, so a
 * longer id is a larger one. */
export function compareSnowflakes(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Highest first, the way the hierarchy is drawn: by position, and at an equal position the older
 * role (smaller id) first - "roles with the same position are sorted by id", a newer role ranks
 * lower. Positions are unique on an up-to-date origin, so the tie-break only matters for roles
 * from an instance that predates that.
 */
export function compareRolesHighestFirst(
  a: Pick<SpaceRole, 'id' | 'position'>,
  b: Pick<SpaceRole, 'id' | 'position'>
): number {
  if (a.position !== b.position) return b.position - a.position;
  return compareSnowflakes(a.id, b.id);
}

/** A space's custom roles - every role but @everyone - highest first. */
export function customRolesHighestFirst<R extends Pick<SpaceRole, 'id' | 'name' | 'position'>>(
  roles: readonly R[],
  everyoneRoleId?: string
): R[] {
  return roles
    .filter((r) => r.id !== everyoneRoleId && r.name !== EVERYONE_ROLE_NAME)
    .sort(compareRolesHighestFirst);
}

/**
 * The first of `count` consecutive positions for the movable roles when they are packed
 * together: their lowest position (at least 1), or lower when the run from there would reach
 * the lowest role they may not move. Below the lowest movable role nothing else sits, since
 * every custom role down there is movable.
 */
function packedStart(orderDesc: readonly Pick<SpaceRole, 'id' | 'position'>[], movable: ReadonlySet<string>, count: number): number {
  let lowest = Number.POSITIVE_INFINITY;
  let ceiling = Number.POSITIVE_INFINITY;
  for (const r of orderDesc) {
    if (movable.has(r.id)) lowest = Math.min(lowest, r.position);
    else ceiling = Math.min(ceiling, r.position);
  }
  return Math.max(1, Math.min(Math.max(1, lowest), ceiling - count));
}

/**
 * The PATCH /spaces/:id/roles entries that put the roles in `movable` in the order `orderDesc`
 * lists them (highest first), by dealing out the positions those roles already hold between
 * them: the highest of those positions to the first of them, and so on down. A role outside
 * `movable` is never written - nothing at or above the viewer is touched - and as the positions
 * are only swapped around, no two roles end up sharing one.
 *
 * `movable` is the bottom of the hierarchy, as the hierarchy makes it: every custom role below
 * the viewer's own highest (all of them for the owner). Where those roles do not hold distinct
 * positions of at least 1 (ties left by an instance from before positions were unique), there is
 * nothing to swap; they take consecutive positions from their lowest instead, starting lower when
 * that run would reach the lowest role they may not move.
 *
 * Only the entries whose position changes are returned, lowest position first.
 */
export function rolePositionEntries(
  orderDesc: readonly Pick<SpaceRole, 'id' | 'position'>[],
  movable: ReadonlySet<string>
): RolePosition[] {
  const moving = orderDesc.filter((r) => movable.has(r.id));
  if (moving.length === 0) return [];
  const held = moving.map((r) => r.position).sort((a, b) => b - a);
  const distinct = held.every((p, i) => p >= 1 && (i === 0 || p !== held[i - 1]));
  let slots = held;
  if (!distinct) {
    const count = moving.length;
    const start = packedStart(orderDesc, movable, count);
    slots = moving.map((_, i) => start + count - 1 - i);
  }
  return moving
    .map((r, i) => ({ id: r.id, position: slots[i]!, from: r.position }))
    .filter((e) => e.position !== e.from)
    .sort((a, b) => a.position - b.position)
    .map(({ id, position }) => ({ id, position }));
}

/**
 * The same new order as one PATCH /spaces/:id/roles/:roleId per role, sent one after another in
 * the order returned - for an instance without PATCH /spaces/:id/roles.
 *
 * Such an instance either stores each position as sent (an older origin), or swaps the role with
 * the one holding that position (an up-to-date origin, reached through a mirror without the list
 * endpoint), falling back to placing it and moving the roles in its way up by one where positions
 * are tied. Here the movable roles take consecutive positions from their lowest (as packedStart
 * puts it), written from the bottom up: each write lands on a free slot or on a movable role that
 * goes to the written role's old place, above everything placed so far, so every kind of instance
 * ends in the same order. Writing starts at the lowest role out of place; from there on every role
 * is sent, since an earlier write may have moved it.
 */
export function rolePositionWrites(
  orderDesc: readonly Pick<SpaceRole, 'id' | 'position'>[],
  movable: ReadonlySet<string>
): RolePosition[] {
  const bottomUp = orderDesc.filter((r) => movable.has(r.id)).reverse();
  if (bottomUp.length === 0) return [];
  const start = packedStart(orderDesc, movable, bottomUp.length);
  const writes: RolePosition[] = [];
  bottomUp.forEach((r, i) => {
    const position = start + i;
    if (writes.length === 0 && r.position === position) return;
    writes.push({ id: r.id, position });
  });
  return writes;
}

/** What saving a new role order sends: see api/spaces.ts saveSpaceRoleOrder. */
export interface RoleOrderPlan {
  /** For PATCH /spaces/:id/roles (rolePositionEntries). Empty when nothing changes. */
  positions: RolePosition[];
  /** For an instance without it: single-role PATCHes, in this order (rolePositionWrites). */
  sequential: RolePosition[];
}

/** Both ways of saving the order `orderDesc` shows, for the roles in `movable`. */
export function planRoleOrder(
  orderDesc: readonly Pick<SpaceRole, 'id' | 'position'>[],
  movable: ReadonlySet<string>
): RoleOrderPlan {
  const positions = rolePositionEntries(orderDesc, movable);
  return { positions, sequential: positions.length ? rolePositionWrites(orderDesc, movable) : [] };
}
