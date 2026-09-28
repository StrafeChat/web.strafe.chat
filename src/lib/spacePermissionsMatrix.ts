import {
  PermAdministrator,
  PermSendMessages,
  PermViewChannel,
  effectiveChannelPermissionsForMember,
} from './spacePermissions';

import type { SpaceRole, SpaceRoomOverride, SpaceRoomUserOverride } from '../api/spaces';

export interface PermissionMatrixCase {
  name: string;
  input: {
    memberUserId: string;
    ownerId: string;
    everyoneRoleId: string;
    memberRoleIds: string[];
    roles: SpaceRole[];
    overrides: SpaceRoomOverride[];
    userOverrides?: SpaceRoomUserOverride[];
  };
  expectMask: number;
}

// Shared frontend validation matrix mirroring backend precedence rules.
export const permissionMatrixCases: PermissionMatrixCase[] = [
  {
    name: 'owner bypass',
    input: {
      memberUserId: 'u1',
      ownerId: 'u1',
      everyoneRoleId: 'r0',
      memberRoleIds: ['r0'],
      roles: [{ id: 'r0', name: '@everyone', permissions: PermViewChannel, position: 0, color: 0, hoist: false, mentionable: false, created_at: '', updated_at: '' }],
      overrides: [],
    },
    expectMask: PermViewChannel | PermSendMessages,
  },
  {
    name: 'admin bypass',
    input: {
      memberUserId: 'u2',
      ownerId: 'u1',
      everyoneRoleId: 'r0',
      memberRoleIds: ['r0', 'rA'],
      roles: [
        { id: 'r0', name: '@everyone', permissions: PermViewChannel, position: 0, color: 0, hoist: false, mentionable: false, created_at: '', updated_at: '' },
        { id: 'rA', name: 'admin', permissions: PermAdministrator, position: 1, color: 0, hoist: false, mentionable: false, created_at: '', updated_at: '' },
      ],
      overrides: [{ role_id: 'rA', allow: 0, deny: PermSendMessages, created_at: '', updated_at: '' }],
    },
    expectMask: PermViewChannel | PermSendMessages,
  },
];

export function evaluatePermissionMatrix(): { name: string; pass: boolean }[] {
  return permissionMatrixCases.map((c) => {
    const got = effectiveChannelPermissionsForMember(c.input);
    return { name: c.name, pass: got !== null && (got & c.expectMask) === c.expectMask };
  });
}
