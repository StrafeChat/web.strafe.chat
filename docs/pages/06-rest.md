---
title: REST API
description: Reference for the endpoints bots and applications use - users, spaces, members, roles, invites, rooms, messages, reactions, attachments - plus error and rate-limit behaviour.
---

# REST API

All paths are relative to this instance's API base: <code data-instance="api">https://your-instance.example/api</code>. Authenticate with `Authorization: Bot <token>` (bots) or `Authorization: Bearer <access token>` (OAuth2, scoped endpoints only). Send and expect JSON; ids are strings.

**Who can call what.** Every endpoint below accepts a bot token unless marked *session only*. OAuth2 tokens reach only the endpoints marked with a scope. A bot is checked against its permissions in the space or room like any member.

## Users

### `GET` /users/@me — *scope: identify or email*

The authenticated account. `email` is present for sessions and bots (a bot's is synthetic) and for OAuth2 tokens with `email`.

```json
{ "id": "…", "email": "", "username": "Docs_Bot", "display_name": "Docs Bot", "bio": "", "about_me": "", "pronouns": "they/them", "birthday": "09-01", "birthday_opt_in": true, "avatar": "", "banner": "", "accent_color": "", "public_flags": 0, "bot": true, "presence": { "status": "online" } }
```

`pronouns` is free text (max 40 characters) and is public, like the bio - it rides along on every user object (message authors, `mention_users`, space members, relationships). `birthday` is `"MM-DD"` with no year, derived from the date of birth given at registration, and `birthday_opt_in` says whether the account wants it announced in spaces. The owner's own `birthday` is returned whether or not they opted in so their settings can show it; on other people's user objects both `birthday` and `is_birthday` appear only after they opt in.

### `PATCH` /users/@me

Update the account's profile: `display_name`, `bio`, `about_me`, `pronouns` (free text, max 40 characters; `""` clears it), `birthday_opt_in` (`true` lets spaces celebrate the account's birthday - the server keeps the announcement index itself), `accent_color` (hex), `presence` (`{"status": "online" | "idle" | "dnd" | "invisible", "custom_status": "…"}`). Avatar and banner are uploaded with `POST /users/@me/avatar` and `/users/@me/banner` (multipart `file`). The date of birth itself cannot be changed over the API.

### `GET` /users/@me/spaces — *scope: spaces*

The account's spaces with `owner` and its space-wide `permissions` there. See [OAuth2 › Listing the person's spaces](/docs/oauth2/#listing-the-persons-spaces).

## Spaces

### `GET` /spaces

Every space the account is in, each with `roles`. Same shape as `READY.spaces`.

### `GET` /spaces/:id

One space (member only) with `roles`.

```json
{
  "id": "2102226824774811648", "name": "Unread Test Space 2", "name_acronym": "UTS", "description": "", "icon": "", "banner": "",
  "owner_id": "2102223172425220096", "everyone_role_id": "2102226824779005952",
  "system_room_id": "2102443061534523392", "system_room_flags": 0, "default_message_notifications": 0,
  "afk_room_id": null, "afk_timeout": 0, "widget_enabled": false, "features": [],
  "roles": [ … ], "created_at": "…", "updated_at": "…"
}
```

### `PATCH` /spaces/:id — *Manage Space*

`name`, `description`, `system_room_id`, `system_room_flags`, `default_message_notifications` (`0` all messages, `1` only mentions), `afk_room_id`, `afk_timeout` (60, 300, 900, 1800 or 3600), `widget_enabled`, `widget_room_id`, `birthday_channel_id`, `birthday_message`. Room ids as strings; `""` clears one. `birthday_channel_id` must be a text room in the space (otherwise `400`) and is where the daily birthday greetings go; `birthday_message` is an optional template, max 500 characters, with `{user}` marking where the member is named - empty uses the default greeting.

### `GET` /spaces/:id/rooms

The space's rooms with overrides and, for the caller, read state. Same shape as `READY.space_rooms[id]`.

### `POST` /spaces/:id/rooms — *Manage Rooms*

`{"name", "type": 3 | 4 | 5, "parent_id"?, "e2ee_enabled"?, "user_limit"?, "bitrate"?}`. Type `3` text, `4` voice, `5` section. Returns the room (`201`).

### `PATCH` /spaces/:id/rooms/:roomId — *Manage Rooms*

`name`, `topic`, `slowmode_seconds`, `e2ee_enabled` (text rooms; turning encryption **on** is one-way for existing history), `user_limit`, `bitrate`, `position`.

### `DELETE` /spaces/:id/rooms/:roomId — *Manage Rooms*

### `GET` /spaces/:id/audit-log — *Manage Space*

`?limit=` (≤100) `&before=<entry id>` `&action=<type>`. Returns `{"entries": [{id, action_type, user_id, target_id, changes, reason, created_at}], "users": {…}}`. Bot installs are `action_type: "bot_add"` with the bot as target.

### `POST` /spaces/:id/leave

Leave the space (the owner cannot; they transfer or delete it).

## Members

### `GET` /spaces/:id/members

Every member with their profile, `roles` (role ids), `joined_at`, `presence`, `public_flags` and `bot`.

### `DELETE` /spaces/:id/members/:userId — *Kick Members*

Kick. A kicked bot's managed role is removed with it.

### `PUT` /spaces/:id/members/:userId/roles — *Manage Roles*

`{"role_ids": ["…"]}` replaces the member's roles (`@everyone` is implied). Hierarchy applies: you can only add or remove roles below your own highest, and roles at or above it that the member already holds are kept. A bot's managed role can neither be given to anyone else nor taken from the bot (`400`).

### `PUT` /spaces/:id/members/:userId — *Create Invite; scope spaces.join on the token in the body*

Add a user who authorized your application with `spaces.join`: `{"access_token": "…"}`. `201` added, `204` already a member. See [OAuth2 › spaces.join](/docs/oauth2/#spaces-join-adding-users-to-a-space).

### Bans — *Ban Members*

`POST /spaces/:id/bans/:userId` `{"reason"?}` bans (and removes) the user; `DELETE /spaces/:id/bans/:userId` lifts it; `GET /spaces/:id/bans` lists the bans (`user_id`, `reason`, `banned_by`, `created_at`) together with the profiles of the users involved. The owner cannot be kicked or banned, and you cannot act on someone whose highest role is at or above yours.

## Roles

### The role object

```json
{ "id": "2105144670576185344", "name": "Docs Bot", "permissions": 8768, "position": 1, "color": 0, "hoist": false, "mentionable": false, "bot_id": "2105141069376131072", "created_at": "…", "updated_at": "…" }
```

`position` orders roles (`@everyone` is `0`; higher outranks lower). `bot_id` is present on a **managed role** created by a bot install: the bot's user id.

### `GET` /spaces/:id/roles

### `POST` /spaces/:id/roles — *Manage Roles*

`{"name", "permissions"?, "color"?, "hoist"?, "mentionable"?}`. You cannot grant permission bits you do not hold (`403`). The new role goes on top of the custom roles.

### `PATCH` /spaces/:id/roles/:roleId — *Manage Roles*

Any of the fields above plus `position`. `@everyone` can only have `permissions` changed; a role at or above your own highest is off limits.

### `DELETE` /spaces/:id/roles/:roleId — *Manage Roles*

Not `@everyone`, not a managed role.

### Room overrides — *Manage Roles*

- `GET /spaces/:id/rooms/:roomId/overrides` → `[{role_id, allow, deny}]`; `PUT …/overrides/:roleId` `{"allow", "deny"}`; `DELETE …/overrides/:roleId`.
- `GET /spaces/:id/rooms/:roomId/overrides/users` → `[{user_id, allow, deny}]`; `PUT …/overrides/users/:userId`; `DELETE …/overrides/users/:userId`.

Only room-scoped bits are accepted (see [Permissions › Room overrides](/docs/permissions/#room-overrides)).

## Invites

### `POST` /spaces/:id/invites — *Create Invite*

`{"max_age_seconds"?: 0…2592000, "max_uses"?: 0…1000}` (`0` = unlimited / never expires). Returns:

```json
{ "code": "k3Dx9qLm", "space_id": "…", "inviter_id": "…", "max_uses": 0, "current_uses": 0, "expires_at": "…", "created_at": "…" }
```

The invite link is `<web>/invite/<code>`.

### `GET` /spaces/:id/invites — *Manage Space*, `DELETE` /spaces/:id/invites/:code — *Manage Space*

### `GET` /spaces/invites/:code — *no auth*

Public preview `{space: {id, name, icon, …}, inviter_display_name}`. `POST /spaces/invites/:code/join` joins (the caller must be a person or a bot allowed to join; bots are normally added through install links instead).

## Rooms

### `GET` /rooms

The account's private messages and group PMs.

### `GET` /rooms/:id

Any room the account can see, space rooms included. Space rooms carry `space_id`; every room carries `e2ee_enabled`.

### `POST` /rooms

Open a PM: `{"recipient_id": "…"}` (or `recipient_handle: "name"`), or a group: `{"name", "recipient_ids": [...]}`. Returns the room. PMs are end-to-end encrypted by default, so a bot can open one but cannot read it until the person turns encryption off for that PM.

### `POST` /rooms/:id/typing

Broadcast a typing indicator (rate limited to one per 5 s per room).

### `POST` /rooms/:id/ack

`{"message_id": "…"}` marks the room read up to that message (clears the caller's unread count and mention badge).

## Messages

### The message object

```json
{
  "id": "2105141783225700352",
  "room_id": "2102443061534523392",
  "sender_id": "2105141069376131072",
  "sender_device_id": "0",
  "plaintext": "pong from the bot",
  "ciphertext": "",
  "reply_to_id": "2105141774585434112",
  "mentions": ["2102223172425220096"],
  "mention_roles": [],
  "mention_everyone": false,
  "attachments": [ { "id": "…", "filename": "chart.png", "url": "https://…/cdn/…", "content_type": "image/png", "size": 48213, "width": 1280, "height": 720 } ],
  "reactions": [ { "emoji": "👋", "count": 1, "me": false } ],
  "pinned": true,
  "pinned_at": "2026-10-06T01:12:00.000Z",
  "pinned_by": "2102223172425220096",
  "created_at": "2026-09-30T03:44:47.421Z",
  "updated_at": "2026-09-30T03:44:47.421Z"
}
```

`plaintext` is present in plain rooms; encrypted rooms carry `ciphertext` instead. `reactions` is included when fetching messages, not in gateway events. `pinned`, `pinned_at` and `pinned_by` are present while the message is pinned in its room. Deleted messages keep their id with a `deleted_at`. System notices have `sender_id: "0"`, a `system_type` (`space_member_join`, `space_member_leave`, `space_birthday`, …) and a `system_payload`. `space_birthday` is posted once a day in the space's `birthday_channel_id` for each opted-in member whose birthday is that day (UTC); its payload is `{"user_id": "…", "message": "…"}`, with `message` being the space's `birthday_message` (possibly empty, meaning use the default greeting).

### `GET` /rooms/:id/messages

`?limit=` (default 50, ≤100) `&before=<message id>` for older history. Newest first. Needs **View Room** and **Read Message History** in the room.

### `GET` /rooms/:id/messages/:msg_id

### `POST` /rooms/:id/messages — *Send Messages*

See [Bots › Sending messages](/docs/bots/#sending-messages). `201` with the message.

### `PATCH` /rooms/:id/messages/:msg_id

`{"plaintext": "…"}` - own messages only.

### `DELETE` /rooms/:id/messages/:msg_id — *own, or Manage Messages*

### `GET` /rooms/:id/messages/search

`?q=<text>` `&has=link|file|image|video|audio` `&limit=`. Plain rooms only. `GET /spaces/:id/messages/search` searches every plain room of a space the caller can read.

### Reactions — *Add Reactions*

`PUT` / `DELETE` /rooms/:id/messages/:msg_id/reactions/:emoji, `GET …/reactions/:emoji` (who reacted). `:emoji` is a URL-encoded unicode emoji or `custom:<id>`. Custom emoji from other spaces need **Use External Emojis**.

### Pins — *Manage Messages in a space room; anyone in a PM or group*

`PUT` / `DELETE` /rooms/:id/messages/:msg_id/pin pin or unpin a message for everyone in the room (`204`, idempotent). A room holds at most 50 pins. Pinning posts a `message_pinned` system message whose `system_payload` names `actor_id` and `message_id`; every change fires [`ROOM_PINS_UPDATE`](/docs/gateway/#events). Deleting a message drops its pin.

`GET` /rooms/:id/pins — the room's pinned messages, newest pin first: `{"items": [{"pinned_at", "pinned_by", "message": {…}}], "has_more": false}`. Needs **View Room** and **Read Message History**.

### `POST` /rooms/:id/attachments — *Send Messages*

`multipart/form-data` with `file` and optional `width`/`height`. Returns the attachment record; reference its `id` in a message within the same room. Size limit per the instance's configuration (25 MB on a default deployment).

## Applications (session only)

Managed from the client's *Settings → Developers*; listed for completeness. Only a person's session may call them, never a bot or an OAuth2 token.

| Method and path | |
| --- | --- |
| `GET` /applications | Your applications |
| `POST` /applications `{"name"}` | Create; returns the app with `client_secret` (once) |
| `GET` /applications/:id, `PATCH` (`name`, `description`, `icon`, `redirect_uris`, `bot_public`), `DELETE` | |
| `GET` /applications/:id/public | Public profile of any application (id, name, description, icon, has_bot, bot_public, bot) - how a client shows *Add to Space* on a bot's profile |
| `POST` /applications/:id/secret | New client secret (once) |
| `POST` /applications/:id/bot | Add the bot; returns it with its `token` (once) |
| `PATCH` /applications/:id/bot (`display_name`, `about_me`, `bio`, `accent_color`), `POST` /applications/:id/bot/avatar, `POST` /applications/:id/bot/banner (multipart `file`) | The bot's profile, edited by the application's owner |
| `POST` /applications/:id/bot/token | New bot token (once); disconnects the bot |
| `GET` /oauth2/@me/grants, `DELETE` /oauth2/@me/grants/:app_id | The applications you authorized, and revoking one |

OAuth2 endpoints (`/oauth2/token`, `/oauth2/token/revoke`, `/oauth2/@me`) are on the [OAuth2](/docs/oauth2/) page.

## Errors

```json
{ "error": "missing permission to send messages in this channel" }
```

| Status | When |
| --- | --- |
| `400` | Invalid JSON, a missing or invalid field, an id that is not a snowflake; OAuth2 `invalid_*` errors |
| `401` | No credential, or an invalid / expired / reset one |
| `403` | Not a member, missing permission, role hierarchy, banned, or an OAuth2 token without the needed scope (`insufficient_scope`) |
| `404` | No such space / room / message / role, or one you cannot see |
| `409` | A conflict (an application that already has a bot, the application limit) |
| `429` | Rate limited or slowmode; see below |
| `500` | Something broke server-side. Retry with backoff |

## Rate limits

| What | Limit |
| --- | --- |
| `POST /oauth2/token`, `POST /oauth2/token/revoke` | 20 per minute per IP |
| Creating applications, secrets and bot tokens | 20 per minute |
| Typing indicators | One broadcast per 5 s per room (extra calls succeed silently) |
| Gateway `op 2` frames | Burst of 20 per connection, refilling one every 250 ms |
| Messages in a room with slowmode | One per `slowmode_seconds` per member; `429` with `retry_after` (seconds) and a `Retry-After` header. Members with Manage Messages are exempt |
| Sign-in, registration, key backup | Separate tight limits (not relevant to bots) |

Other endpoints are not individually limited today; be a good citizen anyway - batch what you can, cache what does not change, and back off on `429` and `5xx`.
