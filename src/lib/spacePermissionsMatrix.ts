import {
  AllRoomPermMask,
  PermAddReactions,
  PermAdministrator,
  PermAttachFiles,
  PermEmbedLinks,
  PermMentionEveryone,
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
  /** Bits that must NOT be in the result. */
  expectDenied?: number;
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
  {
    // The bug of 2026-10-04: the owner's mask must carry every room bit, including ones added
    // after the mask was first written - @everyone denying Attach Files must not touch them.
    name: 'owner keeps every room bit when @everyone denies attach files',
    input: {
      memberUserId: 'u1',
      ownerId: 'u1',
      everyoneRoleId: 'r0',
      memberRoleIds: ['r0'],
      roles: [{ id: 'r0', name: '@everyone', permissions: PermViewChannel | PermSendMessages, position: 0, color: 0, hoist: false, mentionable: false, created_at: '', updated_at: '' }],
      overrides: [{ role_id: 'r0', allow: 0, deny: PermAttachFiles, created_at: '', updated_at: '' }],
    },
    expectMask: AllRoomPermMask,
  },
  {
    name: 'no View Channel means no permissions at all',
    input: {
      memberUserId: 'u2',
      ownerId: 'u1',
      everyoneRoleId: 'r0',
      memberRoleIds: ['r0'],
      roles: [{ id: 'r0', name: '@everyone', permissions: PermViewChannel | PermSendMessages | PermAttachFiles | PermAddReactions, position: 0, color: 0, hoist: false, mentionable: false, created_at: '', updated_at: '' }],
      overrides: [{ role_id: 'r0', allow: 0, deny: PermViewChannel, created_at: '', updated_at: '' }],
    },
    expectMask: 0,
    expectDenied: PermSendMessages | PermAttachFiles | PermAddReactions,
  },
  {
    name: 'no Send Messages clears Attach Files, Embed Links and @everyone only',
    input: {
      memberUserId: 'u2',
      ownerId: 'u1',
      everyoneRoleId: 'r0',
      memberRoleIds: ['r0'],
      roles: [{ id: 'r0', name: '@everyone', permissions: PermViewChannel | PermSendMessages | PermAttachFiles | PermEmbedLinks | PermMentionEveryone | PermAddReactions, position: 0, color: 0, hoist: false, mentionable: false, created_at: '', updated_at: '' }],
      overrides: [],
      userOverrides: [{ user_id: 'u2', allow: 0, deny: PermSendMessages, created_at: '', updated_at: '' }],
    },
    expectMask: PermViewChannel | PermAddReactions,
    expectDenied: PermAttachFiles | PermEmbedLinks | PermMentionEveryone,
  },
  {
    // Bit 30 is the top of the client's 32-bit maths: the owner's mask must still carry it
    // (and stay a positive number) when @everyone denies it in the room.
    name: 'owner keeps Embed Links when @everyone denies it',
    input: {
      memberUserId: 'u1',
      ownerId: 'u1',
      everyoneRoleId: 'r0',
      memberRoleIds: ['r0'],
      roles: [{ id: 'r0', name: '@everyone', permissions: PermViewChannel | PermSendMessages | PermEmbedLinks, position: 0, color: 0, hoist: false, mentionable: false, created_at: '', updated_at: '' }],
      overrides: [{ role_id: 'r0', allow: 0, deny: PermEmbedLinks, created_at: '', updated_at: '' }],
    },
    expectMask: AllRoomPermMask | PermEmbedLinks,
  },
  {
    name: 'a room override denying Embed Links keeps Send Messages',
    input: {
      memberUserId: 'u2',
      ownerId: 'u1',
      everyoneRoleId: 'r0',
      memberRoleIds: ['r0'],
      roles: [{ id: 'r0', name: '@everyone', permissions: PermViewChannel | PermSendMessages | PermEmbedLinks, position: 0, color: 0, hoist: false, mentionable: false, created_at: '', updated_at: '' }],
      overrides: [{ role_id: 'r0', allow: 0, deny: PermEmbedLinks, created_at: '', updated_at: '' }],
    },
    expectMask: PermViewChannel | PermSendMessages,
    expectDenied: PermEmbedLinks,
  },
];

export function evaluatePermissionMatrix(): { name: string; pass: boolean }[] {
  return permissionMatrixCases.map((c) => {
    const got = effectiveChannelPermissionsForMember(c.input);
    const pass = got !== null && (got & c.expectMask) === c.expectMask && (got & (c.expectDenied ?? 0)) === 0;
    return { name: c.name, pass };
  });
}
