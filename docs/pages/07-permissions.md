---
title: Permissions
description: Every permission bit, how a member's permissions resolve from roles and room overrides, role hierarchy, and what a bot can be granted.
---

# Permissions

Permissions are a bitmask: each permission is one bit, a role's `permissions` is the OR of the bits it grants, and a member's permissions are the OR of their roles'. The same numbers appear in role objects, room overrides, the `permissions` parameter of install links, and `GET /users/@me/spaces`.

Add the values of the bits you need to build a mask; test a bit with `(mask & bit) !== 0`.

## The bits

| Bit | Value | Permission | Scope | Lets a member |
| --- | --- | --- | --- | --- |
| 0 | `1` | View Room | room | See the room and read new messages |
| 1 | `2` | Send Messages | room | Post in text rooms |
| 2 | `4` | Read Message History | room | Load older messages |
| 3 | `8` | Add Reactions | room | React to messages |
| 4 | `16` | Use External Emojis | room | Use custom emoji from other spaces |
| 5 | `32` | Mention @everyone | room | Ping everyone with `mention_everyone` |
| 6 | `64` | Manage Messages | room | Delete and pin other members' messages; exempt from slowmode |
| 7 | `128` | Manage Roles | space | Create, edit, delete and assign roles below their own |
| 8 | `256` | Manage Rooms | space | Create, edit, reorder and delete rooms and sections |
| 9 | `512` | Kick Members | space | Kick members ranked below them |
| 10 | `1024` | Ban Members | space | Ban and unban |
| 11 | `2048` | Administrator | space | **Every** permission in the space, overrides ignored. Only ownership transfer and deleting the space stay owner-only |
| 12 | `4096` | Manage Space | space | Edit the space's settings, icon and banner; manage invites; view the audit log; **add bots** |
| 13 | `8192` | Create Invite | space | Create invites; add users with `spaces.join` |
| 14 | `16384` | Manage Emojis | space | Upload, rename and delete custom emoji |
| 15 | `32768` | Connect | room | Join a voice room |
| 16 | `65536` | Speak | room | Use the microphone |
| 17 | `131072` | Video | room | Share camera or screen |
| 18 | `262144` | Mute Members | room | Server-mute others |
| 19 | `524288` | Deafen Members | room | Server-deafen others |
| 20 | `1048576` | Move Members | room | Move or disconnect others |
| 21 | `2097152` | Use Voice Activity | room | Talk without push-to-talk |
| 22 | `4194304` | Priority Speaker | room | Lower everyone else while speaking |
| 23 | `8388608` | Attach Files | room | Upload files and images with a message |

New permissions are only ever appended; existing values never change meaning.

### Useful masks

| Mask | Value |
| --- | --- |
| Read and post (View Room + Send Messages + Read Message History) | `7` |
| `@everyone` in a new space (read, post, attach files, react, external emoji, invite, join and talk in voice) | `10723359` |
| Every room-scoped bit | `16744575` |
| Every bit | `16777215` |

## How permissions resolve

For a member in a space:

1. **Owner?** The space owner has every permission, always.
2. **Space-wide mask** = `@everyone.permissions | role₁.permissions | role₂.permissions …` over the member's roles.
3. **Administrator?** If bit 11 is set, the member has every permission in every room; stop here.
4. **Room overrides**, applied in order to the space-wide mask for that room: the `@everyone` override, then overrides of the member's other roles (each `(mask & ~deny) | allow`), then the member's own user override. Overrides can only touch room-scoped bits.

`GET /users/@me/spaces` and the `permissions` of a space in `READY` give you step 2; to know what a bot may do *in a room*, apply that room's `permission_overrides` and `user_overrides` from `READY.space_rooms` (or `GET /spaces/:id/rooms`) yourself, or simply try the call and handle `403`.

## Room overrides

A room can allow or deny room-scoped bits per role or per member, independent of the space-wide mask. Each override is `{allow, deny}`; a bit in `deny` removes the permission for that role in that room, a bit in `allow` grants it, and a bit in neither leaves the space-wide value. Text rooms accept the text bits (0–6 and 23); voice rooms accept View Room and the voice bits (15–22). Managing overrides needs **Manage Roles**, and you cannot grant through an override what you do not hold yourself.

## Hierarchy

Roles are ordered by `position` (`@everyone` is 0). A member's rank is their highest role's position. Except for the owner:

- You can only create, edit, delete, assign or remove roles **below** your rank.
- You can only kick or ban members whose rank is below yours.
- You can only grant permission bits you hold yourself (Administrators hold all).
- You may always edit your own roles within those rules - including the owner, which is how they give themselves a colour.

A bot is subject to the same rules: give it a role high enough for what it must moderate.

## Bots and permissions

- An install link's `permissions` value becomes the bot's **managed role**, inserted at position 1 (just above `@everyone`) so the person who installed it outranks it. The installer can uncheck bits on the consent page, and the server drops any bit they do not hold themselves. Administrators and the owner can grant everything.
- The managed role can be edited afterwards like any other, moved up if the bot must outrank people it moderates, and shows a bot badge. It cannot be deleted or given to anyone else; it disappears when the bot leaves.
- Additional roles can be assigned to the bot normally.
- Re-approving the install link re-applies the requested bits to the managed role - the way to change a bot's permissions from a link.

> [!TIP]
> Ask for the least you need. A moderation bot wants `64 + 512 + 1024` (Manage Messages, Kick, Ban); a notifier wants `7` or nothing at all (the `@everyone` defaults already let it read and post in most rooms). Asking for Administrator (`2048`) is a red flag to anyone installing your bot.
