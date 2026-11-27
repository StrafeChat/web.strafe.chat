---
title: Permissions
description: Every permission bit, how a member's permissions resolve from roles and room overrides, role hierarchy, and what a bot can be granted.
---

# Permissions

Permissions are a bitmask: each permission is one bit, a role's `permissions` is the OR of the bits it grants, and a member's permissions are the OR of their roles'. The same numbers appear in role objects, room overrides, the `permissions` parameter of install links, and `GET /users/@me/spaces`.

Add the values of the bits you need to build a mask. Masks now go past 32 bits (Manage Webhooks is bit 31, Masquerade bit 32), so never use JavaScript's `&`, `|`, `~` or `<<` on them - those are 32-bit operators: bit 31 comes out negative and bit 32 and up disappear (`1 << 32` is `1`, View Room). Test a bit with BigInt, `(BigInt(mask) & (1n << 31n)) !== 0n`, or with 64-bit integers in other languages.

## The bits

| Bit | Value | Permission | Scope | Lets a member |
| --- | --- | --- | --- | --- |
| 0 | `1` | View Room | room | See the room and read new messages |
| 1 | `2` | Send Messages | room | Post in text rooms |
| 2 | `4` | Read Message History | room | Load older messages |
| 3 | `8` | Add Reactions | room | Start a new emoji reaction on a message; joining an existing one only needs Read Message History |
| 4 | `16` | Use External Emojis | room | Use custom emoji from other spaces |
| 5 | `32` | Mention @everyone | room | Ping everyone with `mention_everyone`, and ping roles that are not mentionable |
| 6 | `64` | Manage Messages | room | Delete and pin other members' messages; exempt from slowmode |
| 7 | `128` | Manage Roles | space | Create, edit, reorder and delete roles below their own, and give them to or take them from anyone; edit room permission overrides (only bits they hold in that room) |
| 8 | `256` | Manage Rooms | space | Create, edit, reorder and delete rooms and sections; exempt from slowmode |
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
| 24 | `16777216` | Create Public Threads | room | Start a thread anyone in the channel can see |
| 25 | `33554432` | Create Private Threads | room | Start an invite-only thread |
| 26 | `67108864` | Send Messages In Threads | room | Talk in threads (Send Messages alone does not grant it) |
| 27 | `134217728` | Manage Threads | room | Rename, archive, lock and delete any thread; see private threads |
| 28 | `268435456` | Change Nickname | space | Set or clear their own nickname in the space (on for `@everyone` by default) |
| 29 | `536870912` | Manage Nicknames | space | Change or clear the nicknames of members ranked below them, and reset those members' space profiles (avatar, banner, pronouns, About Me, bio); their own nickname too |
| 30 | `1073741824` | Embed Links | room | Post a message with rich [embeds](/docs/embeds/) (bots), on top of Send Messages. On for `@everyone` by default; spaces created before it existed have it wherever Send Messages was granted |
| 31 | `2147483648` | Manage Webhooks | room | Create, edit, reset and delete the room's [webhooks](/docs/rest/#webhooks), and allow one to ping `@everyone` (with Mention @everyone too); change, pause and remove the room's [bridges](/docs/rest/#bridges). Executing a webhook needs only its token. Off by default |
| 32 | `4294967296` | Masquerade | room | Run [bridges](/docs/rest/#bridges) that post as people from other platforms: a bot needs it, with Manage Webhooks, to create a bridge, and keeps needing it (with View Room and Send Messages) to post through one. Off by default; cleared without Send Messages |

New permissions are only ever appended; existing values never change meaning.

### Writing permissions: send a string

Every value is below 2^53, so a JSON number reads exactly in every language, and responses keep sending numbers. **Writes** are different: a client from before bit 31 does its maths in 32 bits, so the server reads the two forms differently wherever a permission is written (role `permissions`, override `allow`/`deny`, the `permissions` of an install or an OAuth2 authorize):

- a **decimal string** (`"6442450944"`) is the full value. It must be a whole number below 2^53 made of known bits, or the request fails with `400 unknown_permission_bits`;
- a **JSON number** is the legacy form: the server keeps its low 31 bits (which also repairs a negative number an old client produced) and **keeps whatever bits 31 and up were already stored** (none on a create).

So send permissions as strings, and keep them in a 64-bit integer, a BigInt, or a JavaScript number you never apply bitwise operators to. A client that still sends numbers keeps working, but cannot set or clear Manage Webhooks or Masquerade.

### Useful masks

| Mask | Value |
| --- | --- |
| Read and post (View Room + Send Messages + Read Message History) | `7` |
| `@everyone` in a new space (read, post, attach files, embed links, react, external emoji, invite, start public threads and talk in threads, join and talk in voice, change their nickname) | `1436786719` |
| Every room-scoped bit | `7784595583` |
| Every bit | `8589934591` |

## How permissions resolve

For a member in a space:

1. **Owner?** The space owner has every permission, always.
2. **Space-wide mask** = `@everyone.permissions | role₁.permissions | role₂.permissions …` over the member's roles.
3. **Administrator?** If bit 11 is set, the member has every permission in every room; stop here.
4. **Room overrides**, applied in order to the space-wide mask for that room: the `@everyone` override, then overrides of the member's other roles (every deny first, then every allow), then the member's own user override (deny, then allow). Overrides can only touch room-scoped bits.
5. **Threads** have no overrides of their own: a thread resolves against its channel's effective overrides (and so a synced section's), with the thread bits above on top. A private thread yields no permissions at all to anyone who is neither a member nor a Manage Threads holder.
6. **Two implicit rules**, the same as Discord's: without View Room the member has no permission at all in that room, whatever the bits say; and without Send Messages they cannot Attach Files, Embed Links, Mention @everyone or Masquerade either (Manage Webhooks stays: it is management, not posting).

Administrator also grants every space-scoped permission for management actions (adding bots, editing the space, invites, emoji, roles, nicknames, kicks and bans), though role hierarchy still applies to Administrators - only the owner is above it.

`GET /users/@me/spaces` and the `permissions` of a space in `READY` give you step 2; to know what a bot may do *in a room*, apply that room's `permission_overrides` and `user_overrides` from `READY.space_rooms` (or `GET /spaces/:id/rooms`) yourself, or simply try the call and handle `403`.

## Room overrides

A room can allow or deny room-scoped bits per role or per member, independent of the space-wide mask. Each override is `{allow, deny}`; a bit in `deny` removes the permission for that role in that room, a bit in `allow` grants it, and a bit in neither leaves the space-wide value. Text rooms accept the text bits (0–6, 23–27 and 30–32); voice rooms accept View Room, the voice bits (15–22) and Manage Webhooks (31), since a voice room's text can hold webhooks. Managing overrides needs **Manage Roles**, and you cannot grant through an override what you do not hold yourself.

## Hierarchy

Roles are ordered by `position`: `@everyone` is always `0`, the custom roles hold unique positions from `1` up, and higher outranks lower. A member's rank is their highest role's position. The rules are Discord's, and they bind everyone but the owner - Administrators included:

- **Roles**: you can only create, edit, reorder or delete roles **below** your rank.
- **Giving or taking a role depends only on the role.** You can give anyone a role below your rank, or take one away - the owner, and members ranked above you, included. Roles the member holds at or above your rank are kept as they are.
- **Kicking, banning and nicknames depend on the member**: you can only kick or ban members whose rank is below yours, and only change the nickname of (or reset the space profile of) members whose rank is below yours. Only the owner can change the owner's; nobody can kick or ban the owner.
- You can only grant permission bits you hold yourself (Administrators hold all), on roles and in room overrides.
- You may always edit your own roles within those rules - including the owner, which is how they give themselves a colour.
- A bot's managed role is never given to anyone else, nor taken from its bot.

A bot follows the same rules: to give out a role it needs Manage Roles and a role **above** that role, and to kick or ban someone a role above theirs - see [Bots › Giving people roles](/docs/bots/#giving-people-roles).

### Positions

- A **new role** goes in at position `1`, just above `@everyone` - so whoever creates a role (a moderator, a bot) ranks above it and can manage it. Only the unbroken run of roles directly above it moves up one to make room; roles above a gap in the positions keep theirs. Read the new positions from the response and the `SPACE_UPDATE` that carries them rather than working them out.
- **Moving one role** (`PATCH /spaces/:id/roles/:roleId` with `position`) swaps it with the role holding that position, or puts it there as sent when no role holds it.
- **Moving several roles** at once ([`PATCH /spaces/:id/roles`](/docs/rest/#patch-spaces-id-roles-manage-roles)) puts each listed role in its slot; the role there, and any above it in the way, move up one, and every role not listed keeps its order around them. It is all or nothing - use it for any reorder of more than one role.
- Either way, no two roles ever share a position.
- Two roles with the same position - possible only in data from an instance that predates unique positions - rank by id: the newer one is lower.

## Bots and permissions

- An install link's `permissions` value becomes the bot's **managed role**, inserted at position 1 (just above `@everyone`) so the person who installed it outranks it. The installer can uncheck bits on the consent page, and the server drops any bit they do not hold themselves. Administrators and the owner can grant everything.
- Because the managed role starts at the bottom, a bot that gives out roles can at first only give out roles created after it. Drag its role above the roles it should hand out, under **Space settings → Roles** - see [Bots › Giving people roles](/docs/bots/#giving-people-roles).
- The managed role can be edited afterwards like any other, moved up if the bot must give out roles or outrank people it moderates, and shows a bot badge. It cannot be deleted or given to anyone else; it disappears when the bot leaves.
- Additional roles can be assigned to the bot normally.
- Re-approving the install link re-applies the requested bits to the managed role - the way to change a bot's permissions from a link.

> [!TIP]
> Ask for the least you need. A moderation bot wants `64 + 512 + 1024` (Manage Messages, Kick, Ban); a notifier wants `7` or nothing at all (the `@everyone` defaults already let it read and post in most rooms). Asking for Administrator (`2048`) is a red flag to anyone installing your bot.
