---
title: REST API
description: Reference for the endpoints bots and applications use - the instance, users, spaces, members, roles, invites, rooms, messages, reactions, attachments, webhooks, bridges, GIFs, the image proxy - plus error and rate-limit behaviour.
---

# REST API

All paths are relative to this instance's API base: <code data-instance="api">https://your-instance.example/api</code>. Authenticate with `Authorization: Bot <token>` (bots) or `Authorization: Bearer <access token>` (OAuth2, scoped endpoints only). Send and expect JSON; ids are strings.

**Who can call what.** Every endpoint below accepts a bot token unless marked *session only*. OAuth2 tokens reach only the endpoints marked with a scope. A bot is checked against its permissions in the space or room like any member.

## Instance

### `GET` / — *no auth*

What this instance is and what it has switched on. Clients read it before anyone signs in.

```json
{ "strafe": { "version": "…" }, "federation": { "enabled": true, "domain": "your-instance.example" }, "features": { "captcha": { "enabled": true, "provider": "altcha" }, "email": { "enabled": true, "verification_required": false }, "invite_only": { "enabled": false }, "voice": { "enabled": true }, "gifs": { "enabled": true, "providers": ["giphy"] }, "activities": { "enabled": true } }, "services": { "cdn": { "enabled": true, "url": "…" }, "voice": { "enabled": true, "url": "…" } } }
```

`features.gifs.providers` lists the GIF providers (`giphy`, `heypster`) this instance has an API key for, and `enabled` is true when there is at least one; see [GIFs](#gifs). The keys themselves never leave the server.

`features.activities.enabled` is true when the instance takes activities ("Playing …") over the gateway's `op 9` and shows them on presences; see [Gateway › Activity](/docs/gateway/#activity). Clients send none to an instance without it.

## Users

### `GET` /users/@me — *scope: identify or email*

The authenticated account. `email` is present for sessions and bots (a bot's is synthetic) and for OAuth2 tokens with `email`.

```json
{ "id": "…", "email": "", "username": "Docs_Bot", "display_name": "Docs Bot", "bio": "", "about_me": "", "pronouns": "they/them", "birthday": "09-01", "birthday_opt_in": true, "avatar": "", "banner": "", "accent_color": "", "public_flags": 0, "bot": true, "presence": { "status": "online" } }
```

`presence` is [the presence object](#the-presence-object), as only you see it. Its `activities` reach sessions and bots only: an OAuth2 access token gets the status and custom status but never the activity, since no scope asks for it.

`pronouns` is free text (max 40 characters) and is public, like the bio - it rides along on every user object (message authors, `mention_users`, space members, relationships). `birthday` is `"MM-DD"` with no year, derived from the date of birth given at registration, and `birthday_opt_in` says whether the account wants it announced in spaces. The owner's own `birthday` is returned whether or not they opted in so their settings can show it; on other people's user objects both `birthday` and `is_birthday` appear only after they opt in.

### Deleted accounts

An instance administrator can delete an account or a bot for good. Its username and email address are free again at once, but what it wrote stays: its messages, reactions and pins keep their `sender_id`, and wherever a user object for it is still embedded - a message's `author`, `mention_users`, a `referenced_message`'s author, a PM's `participants` - the server sends a placeholder instead:

```json
{ "id": "…", "username": "", "display_name": "", "avatar": "", "bot": false, "system": false, "deleted": true }
```

`deleted` is present (and `true`) only on that placeholder. Show it as "Deleted User", and never resolve it to an account by name: the username is empty on purpose, because someone else may register the old one and get a new id. Ids are never reused. A deleted account is no longer in any member list, friend list or group PM. A 1:1 PM with it stays readable, but sending (or calling) there answers `403` `this account no longer exists` (`code: "recipient_deleted"`). On another instance the account's copy is kept as a blank placeholder in the same way.

### The presence object

```json
{ "status": "online", "custom_status": "brb", "activities": [ { "type": "playing", "name": "Factory Builder", "started_at": 1761000000000 } ] }
```

| Field | |
| --- | --- |
| `status` | `online`, `idle`, `dnd` or `offline`. Your own presence can also be `invisible`; everyone else sees an invisible account as `offline` |
| `custom_status` | The account's custom status, absent when there is none |
| `activities` | What the account is doing right now, absent when nothing: at most one entry, `type` `"playing"`, the game's `name` (1-128 characters; show it as plain text) and `started_at` (unix ms). Set over the gateway with [`op 9`](/docs/gateway/#activity) and kept only in the instance's short-lived cache while the reporting connection is open - never in its database. It appears on your own presence, on space [member objects](#the-member-object) and on friends' entries - never while the account appears offline or invisible to you, and not on every user object: a message author or a PM's recipients carry none, so keep the last value you saw rather than clearing it from those. Sessions and bot tokens see it; an OAuth2 access token never does (`GET /users/@me` gives it the status without `activities`) |

### `PATCH` /users/@me

Update the account's profile: `display_name`, `bio`, `about_me`, `pronouns` (free text, max 40 characters; `""` clears it), `birthday_opt_in` (`true` lets spaces celebrate the account's birthday - the server keeps the announcement index itself), `accent_color` (hex), `presence` (`{"status": "online" | "idle" | "dnd" | "invisible", "custom_status": "…"}` - `activities` is not set here but over the gateway). Avatar and banner are uploaded with `POST /users/@me/avatar` and `/users/@me/banner` (multipart `file`); `PATCH` only clears them (`"avatar": ""`, `"banner": ""`), after which the account shows its [default avatar](#default-avatars). The date of birth itself cannot be changed over the API. The email address is not changed here; see [Email address](#email-address-session-only).

### Default avatars

A user whose `avatar` is empty (`""`, absent or `null`) - and a deleted account's placeholder, which still carries its `id` - is shown with one of eight default avatars, the same way Discord picks a "Default User Avatar". Every instance serves them from its web client, as fixed-size 256x256 PNGs:

```
https://<web client origin>/avatars/default/<index>.png
```

```js
index = (BigInt(homeId) >> 22n) % 8n
```

`homeId` is the id the user's **home** instance knows them by, so a person has the same default everywhere. For someone from another instance that is the `origin_id` their user objects carry (beside `home_domain`; the `id` is only this instance's copy of them). For a local account, `origin_id` - when present - equals `id`; use `id` when there is no `origin_id`. An id that is missing or not a snowflake gets index `0`. Bots follow the same rule with their user id, which is their application's client id.

The order is part of the contract and never changes: `0` green, `1` teal, `2` blue, `3` violet, `4` pink, `5` red, `6` orange, `7` slate. The same image applies inside a space when the member has no `space_avatar` and no global `avatar`, and wherever an avatar URL fails to load.

### `GET` /users/@me/spaces — *scope: spaces*

The account's spaces with `owner` and its space-wide `permissions` there. See [OAuth2 › Listing the person's spaces](/docs/oauth2/#listing-the-persons-spaces).

### Connections

Accounts a person has elsewhere, verified, on their profile. Each has a **visibility**: `me`, `friends`, `spaces` (friends and people sharing a space) or `everyone`; a new one starts at `me`. Strafe keeps the account's name, a link and how it was verified: no third-party token outlives the verification.

| Provider | How it is verified | Offered |
| --- | --- | --- |
| `domain` | A TXT record `_strafe-verify.<domain>` = `strafe-verify=<token>`, or the same line at `https://<domain>/.well-known/strafe-verify`; re-checked weekly | Always |
| `fediverse` | The person's Strafe address (`https://<instance>/@<username>`) in a profile field or the bio, read through WebFinger and the ActivityPub actor; re-checked weekly | When the instance has a web URL |
| `bluesky` | AT Protocol OAuth: the account that signs in must be the handle's DID | When the API has a public https URL (or runs on loopback in development) |
| `github`, `discord` | OAuth with the operator's own app | When the operator configured one |

A re-check that finds no proof twice in a row marks the connection unverified (`verified: false`); it stays on the profile without the mark.

#### `GET` /users/:id/connections

What the caller may see: `{ "connections": [{ "provider", "name", "url", "verified", "verified_by" }] }`. `verified_by` is the account's home instance; a remote account's connections are asked of its home, which decides for the caller. A block either way shows nothing.

#### `GET` /users/@me/connections — *scope: connections for OAuth2 tokens*

With a session: every connection (`id`, `provider`, `name`, `url`, `method`, `verified`, `visibility`, `position`, `verified_at`, `checked_at`), the `settings` (`public_page`), the account's `address` and the instance's `providers`. With an OAuth2 token: only the connections visible to everyone, in the shape above.

#### Adding one (session only)

- `POST /users/@me/connections/:provider` with `{ "identifier"? }` starts: for a proof provider the answer has `instructions` (`dns_name`, `dns_value`, `https_url`, `https_body`, or `address`) and a `challenge_id`; for an OAuth one an `authorize_url` to send the browser to. It comes back through `GET /connections/:provider/callback`, which ends on `<web>/settings/connections?connected=<provider>` or `?error=<code>`. A challenge lasts 30 minutes.
- `POST /users/@me/connections/:provider/verify` with `{ "challenge_id" }` looks for the proof now: `422 proof_not_found` with `reason` `not_found`, `unreachable`, `signed_fetch` (the server only answers signed requests) or `mismatch`.
- `PATCH /users/@me/connections/:provider/:id` with `{ "visibility"?, "position"? }`; `POST …/:id/recheck`; `DELETE …/:id`. `:id` is URL-encoded (an actor URL, a DID).
- `PATCH /users/@me/connections/settings` with `{ "public_page" }` turns the public page at `<web>/@<username>` on or off (off by default); `GET /public/users/:username` is its data, with no auth.

One identity belongs to at most one account per instance: a second claim answers `409 connection_claimed`. At most 20 connections per account (`409 connection_limit`). `USER_CONNECTIONS_UPDATE` arrives on the account's own channel when they change.

### Email address (session only)

Reading and changing the account's own address. Only a person's session may call these: a bot token gets `403 session_required`, an OAuth2 token `403 insufficient_scope`. Every route answers the same object, with `Cache-Control: no-store`:

```json
{ "email": "jane@example.com", "verified_email": true, "pending": { "email": "jane@new.example", "expires_at": "2026-11-15T15:04:05Z" } }
```

`verified_email` means the same as on `GET /users/@me`. `pending` is `null` when no change is waiting; otherwise it is the address that was asked for, in full, and when the request lapses (RFC 3339, UTC).

| Method and path | |
| --- | --- |
| `GET` /users/@me/email | The current state |
| `POST` /users/@me/email `{"email", "password", "code"?, "recovery_code"?}` | Ask for a change. `202` with `pending` set on an instance that can send email; `200` with the change already applied (and `verified_email: false`) on one that cannot |
| `POST` /users/@me/email/pending/resend | Send the confirmation again (`202`). The link that was sent before stops working |
| `DELETE` /users/@me/email/pending | Cancel the pending change (`200`, `pending: null`). Answers `200` when nothing was pending, too |
| `POST` /users/@me/email/confirm `{"token"}` | Redeem the token from the link (`200`, `pending: null`, `verified_email: true`). Confirming the same token again within the hour also answers `200` |

How a change goes:

- **With email on** (`features.email.enabled` on `GET /`), nothing changes until the link sent to the new address is opened while signed in to the same account (the link is `<instance>/confirm-email?token=…`; a client confirms with the token). The answer to the request is the same `202` whether or not the new address is free; if it belongs to another account, that address is told so and no link is issued.
- An account has **at most one pending change**, and it lasts **1 hour**. A newer request replaces the older one, whose link stops working.
- The old address is told that a change was asked for and, once confirmed, that it happened - with the new address masked (`j***@g***.com`), never in full.
- **Without email**, the change applies as soon as the request is re-authenticated, and the new address is unverified. A taken address answers `409 email_in_use`.
- **Re-authentication** on every request: `password`, plus either `code` (from the authenticator app) or `recovery_code` (consumed) when the account has two-factor authentication or a passkey. Passkeys cannot be used for this; an account with only passkeys sends a recovery code.
- No session is signed out by a change.

| Status | `code` | When |
| --- | --- | --- |
| 400 | `invalid_body` | `email` or `password` missing, both `code` and `recovery_code` sent, or no `token` |
| 400 | `invalid_email` | Not a valid address |
| 400 | `email_unchanged` | The new address is the current one |
| 400 | `disposable_email` | The instance does not accept that domain |
| 400 | `email_change_token_invalid` | The link is unknown, expired, replaced by a newer request, or cancelled |
| 401 | `invalid_password` | Wrong password |
| 401 | `invalid_code` | Wrong or reused authenticator code (or a code for an account without one) |
| 401 | `invalid_recovery_code` | Unknown or used recovery code |
| 403 | `mfa_required` | The account has a second factor and no code was sent |
| 403 | `session_required` | Not a person's session (a bot token, the instance's own account) |
| 403 | `email_change_wrong_account` | The link belongs to another account |
| 403 | `insufficient_scope` | An OAuth2 token |
| 404 | `no_pending_email_change` | Resend with nothing pending |
| 409 | `email_in_use` | Without email: the address is taken. On confirm: it was claimed by someone else meanwhile |
| 409 | `email_change_stale` | The account's address changed after the link was sent |
| 409 | `email_change_busy` | Another change to the account's address is in progress; try again |
| 429 | `email_cooldown` | One change mail a minute (request and resend share it) |
| 429 | `email_target_limited` | Three change mails to one address an hour |
| 429 | `reauth_locked` | Ten failed re-authentications in an hour |
| 503 | `email_disabled` | Resend on an instance without email |

Rate limits, per route (per IP / per account): `GET` 60 a minute / 30 a minute; request and resend 10 a minute / 5 per 15 minutes; cancel 30 a minute / 10 per 15 minutes; confirm 10 a minute / 10 per 15 minutes. Past one, the answer is `429` with `retry_after`.

A change reaches the account's own sessions as [`USER_EMAIL_UPDATE`](/docs/gateway/#account).

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

`{"name", "type": 3 | 4 | 5, "parent_id"?, "e2ee_enabled"?, "user_limit"?, "bitrate"?}`. Type `3` text, `4` voice, `5` section. Returns the room (`201`). A space holds at most 500 rooms and 250 roles (`400` beyond that).

### `PATCH` /spaces/:id/rooms/:roomId — *Manage Rooms*

`name`, `topic`, `slowmode_seconds`, `e2ee_enabled` (text rooms; turning encryption **on** is one-way for existing history), `user_limit`, `bitrate`, `position`, `permissions_synced`, `announcement` (text rooms: makes it an [announcement room](#announcement-rooms); turning it off ends every follow of it). You must be able to view the room; `permissions_synced` rewrites the room's overrides, so it needs *Manage Roles* as well, and only for overrides you could have written yourself.

### `DELETE` /spaces/:id/rooms/:roomId — *Manage Rooms*

### `GET` /spaces/:id/audit-log — *Manage Space*

`?limit=` (≤100) `&before=<entry id>` `&action=<type>`. Returns `{"entries": [{id, action_type, user_id, target_id, changes, reason, created_at}], "users": {…}}`. Bot installs are `action_type: "bot_add"` with the bot as target. Webhooks and bridges log `webhook_create`, `webhook_update`, `webhook_delete`, `webhook_token_reset`, `bridge_create`, `bridge_update`, `bridge_delete`, `bridge_puppet_block`, `bridge_puppet_unblock` (target: the webhook, bridge or bridged user) and `bridge_consent_update` (the space's [bridge mode](#bridges-and-privacy)); a change made with a webhook's own token has actor `0` and `changes.via = "token"`.

### `POST` /spaces/:id/leave

Leave the space (the owner cannot; they transfer or delete it).

## Members

### The member object

```json
{
  "id": "2102223172425220096", "username": "turtle", "display_name": "Turtle", "avatar": "", "banner": "", "bio": "", "about_me": "", "pronouns": "",
  "bot": false, "public_flags": 0, "presence": { "status": "online" },
  "joined_at": "2026-10-13T12:00:00Z", "roles": ["2102226824779005952"],
  "nick": "Shell", "space_avatar": "https://cdn.your-instance.example/v1/spaces/members/…/avatar-….png",
  "space_banner": null, "space_about_me": null, "space_bio": null, "space_pronouns": null
}
```

`presence` is the member's [presence](#the-presence-object), including what they are playing. The user fields (`display_name`, `avatar`, `bio`, `about_me`, `pronouns`, …) are always the member's **global** profile. The six space-profile keys are their profile in this space only, and every member object carries all six, each a string or `null`: `nick` (max 32 characters), `space_avatar` and `space_banner` (image URLs, set only through the upload endpoints below), `space_about_me` and `space_bio` (max 190 each), `space_pronouns` (max 40). Where one is set it replaces the global value inside this space - show `nick` instead of the display name, `space_avatar` instead of `avatar`, and so on. A space profile is visible to the space's members only, and it is deleted with the membership: leaving, a kick, a ban or the space's deletion removes it.

### `GET` /spaces/:id/members

Every member as a member object.

### `GET` /spaces/:id/members/:userId

One member as a member object; `@me` for yourself. You must be a member yourself (`403`), and `404` `member not found` means they are not one.

### `PATCH` /spaces/:id/members/:userId — *Change Nickname for your own, Manage Nicknames for others'*

Set part of a space profile: `nick`, `about_me`, `bio`, `pronouns`, `avatar`, `banner`. A key that is absent is left alone; `null` or `""` clears it; values are trimmed. Returns the updated member object and sends `SPACE_MEMBER_UPDATE`. A request that changes nothing returns `200` with no event.

- **Yourself** (`@me`): `nick` needs **Change Nickname** (on for `@everyone` by default) or **Manage Nicknames**; the other fields need only membership. `avatar` and `banner` accept only a clear (`null` or `""`) - set an image with the upload endpoints below.
- **Another member**, with **Manage Nicknames** and a highest role above theirs: `nick` (set or clear), and `null` (or `""`) for any of `avatar`, `banner`, `about_me`, `bio` and `pronouns`, which resets it to their global profile. A non-empty value for those five is `403` `only the member can change their own space avatar, banner, pronouns, about me or bio` (`code: "cannot_edit_member_profile"`). Only the owner can change the owner's nickname or profile, Administrators included: anyone else gets `403` `only the space owner can change the owner's nickname` when the request touches `nick`, and `403` `only the space owner can change the owner's space profile` when it only resets the other fields.

A moderator's nickname change is logged as `member_nick_update` (`changes.nick` with the old and new value) and a reset as `member_profile_reset` (`changes.fields`, the fields that were cleared). Changes to your own profile are never logged. In a space hosted on another instance the change is made there, where the space profile lives.

Errors: `400` `no fields to update`, `400` for a value over its limit or a nickname that is not on one line, `400` `avatar and banner must be uploaded, or cleared with null`, `403` `missing permission to change your nickname in this space`, `403` `only the space owner can change the owner's nickname`, `403` `only the space owner can change the owner's space profile`, `403` `only the member can change their own space avatar, banner, pronouns, about me or bio` (`code: "cannot_edit_member_profile"`), `403` `cannot manage a role or member at or above your own highest role`, `404` `member not found`, `409` `the space profile changed while saving; try again` (another write to the same image won the race; send it again).

### `POST` /spaces/:id/members/@me/avatar, `POST` /spaces/:id/members/@me/banner

Upload your own space avatar or banner: multipart `file`, png, jpg, gif or webp, within the same size limits as the global ones. Only membership is needed. Returns the member object with `space_avatar` / `space_banner` set; the image it replaces is deleted. To remove one, `PATCH` it to `null`.

Errors: `400` `missing file field`, `400` `invalid file size`, `400` `unsupported image type (use jpg, png, gif, or webp)`, `403` when you are not a member, `502` `could not store image`, `503` `file uploads are not configured` (the instance has no object storage set up).

### `DELETE` /spaces/:id/members/:userId — *Kick Members*

Kick. A kicked bot's managed role is removed with it.

### `PUT` /spaces/:id/members/:userId/roles — *Manage Roles*

`{"role_ids": ["…"]}` replaces the member's roles (`@everyone` is implied); `204`. As on Discord, only the **roles** decide, never the member's rank: you can change anyone's roles - your own, the space owner's, a member ranked above you - as long as every role you add or remove is below your own highest (the owner has no limit). Roles at or above it that the member already holds are kept whatever the list says, so leaving one out does not remove it. A bot's managed role can neither be given to anyone else nor taken from the bot.

Errors: `400` `unknown role id`, `400` `this role belongs to a bot and cannot be deleted or assigned`, `403` `missing permission`, `403` `cannot manage a role or member at or above your own highest role` (a role you add is at or above yours), `403` `not a member of this space`.

### `PUT` /spaces/:id/members/:userId/roles/:roleId, `DELETE` /spaces/:id/members/:userId/roles/:roleId — *Manage Roles*

Give a member one role, or take one away - Discord's Add / Remove Guild Member Role. `204`, also when they already have the role (or, for `DELETE`, do not), in which case nothing is written and no event is sent. Each is a single atomic change to the member's role set, so two bots giving out different roles to the same person at the same moment cannot undo each other; prefer these to the full-list `PUT` whenever you change one role. (That holds on every instance once the space's origin is up to date; in a space mirrored from an older origin, the change reaches the origin as a full-list write.) The same rules apply: the role must be below your own highest role, whatever the member's rank (the owner included), and a managed role is never assignable. Unlike the full-list `PUT`, which quietly keeps a role at or above yours, `DELETE` refuses to take one away (`403`). A change sends `SPACE_MEMBER_UPDATE` and is written to the audit log as `member_roles_update`.

Errors: `400` when `:roleId` is `@everyone` (every member always has it), `400` `this role belongs to a bot and cannot be deleted or assigned`, `403` `missing permission`, `403` `cannot manage a role or member at or above your own highest role`, `403` `not a member of this space` (the user is not in the space), `404` `role not found`.

### `PUT` /spaces/:id/members/:userId — *Create Invite; scope spaces.join on the token in the body*

Add a user who authorized your application with `spaces.join`: `{"access_token": "…"}`. `201` added, `204` already a member. See [OAuth2 › spaces.join](/docs/oauth2/#spaces-join-adding-users-to-a-space).

### Bans — *Ban Members*

`POST /spaces/:id/bans/:userId` `{"reason"?}` bans (and removes) the user - someone who has already left or been kicked can be banned too, so a live invite does not let them back in; `DELETE /spaces/:id/bans/:userId` lifts it; `GET /spaces/:id/bans` lists the bans (`user_id`, `reason`, `banned_by`, `created_at`) together with the profiles of the users involved. The owner cannot be kicked or banned, and you cannot act on someone whose highest role is at or above yours.

## Roles

### The role object

```json
{ "id": "2105144670576185344", "name": "Docs Bot", "permissions": 8768, "position": 1, "color": 0, "hoist": false, "mentionable": false, "bot_id": "2105141069376131072", "created_at": "…", "updated_at": "…" }
```

`permissions` comes back as a JSON number (exact: every bit is below 2^53). **Send it as a decimal string** when you write it (`"permissions": "2147483648"`): a JSON number is read as the legacy 31-bit form and cannot set or clear Manage Webhooks (bit 31) or Masquerade (bit 32) - see [Permissions › Writing permissions](/docs/permissions/#writing-permissions-send-a-string). The same goes for override `allow` / `deny`.

`position` orders roles: `@everyone` is always `0`, custom roles hold unique positions from `1` up, and higher outranks lower (see [Permissions › Hierarchy](/docs/permissions/#hierarchy)). `bot_id` is present on a **managed role** created by a bot install: the bot's user id.

### `GET` /spaces/:id/roles

Every role of the space, `@everyone` included. Any member may list them.

### `POST` /spaces/:id/roles — *Manage Roles*

`{"name", "permissions"?, "color"?, "hoist"?, "mentionable"?}`. You cannot grant permission bits you do not hold (`403`). The new role goes in at **position 1**, just above `@everyone` - as on Discord, and so that whoever created the role (a moderator, a bot) can manage it and give it out straight away. Only the unbroken run of roles directly above it moves up one to make room; roles above a gap in the positions keep theirs. Returns the role (`201`) with its position. Members get `SPACE_ROLE_CREATE`, and when roles moved up they arrive in one `SPACE_UPDATE` carrying `roles`. Read the new positions from the response and that event rather than working them out.

### `PATCH` /spaces/:id/roles — *Manage Roles*

Move several roles at once - Discord's Modify Guild Role Positions. The body is a list of `{"id", "position"}`:

```json
[{ "id": "2105144670576185344", "position": 5 }, { "id": "2105144670576185999", "position": 4 }]
```

Each listed role is placed at its `position` and every other role keeps its order around them: a listed role that lands on a taken position takes it, and the role there (and any above it in the way) moves up one. Two listed roles asking for the same position: the newer one goes lower. Positions stay unique. To reorder a block of roles without touching anything else, give them the positions they already hold, in the new order - the example swaps two roles that sit at 4 and 5.

1 to 250 entries, each id once, each an existing custom role of the space, each `position` from 1 to 2147483397; managed roles can be moved, `@everyone` cannot. Except for the owner, every listed role must be below your own highest role **and** so must every position you ask for - otherwise nothing is written. Returns `200` with every role of the space (the `GET` shape). Members get one `SPACE_UPDATE` carrying the full `roles` list. Each listed role whose position changed is written to the audit log (`role_update` with `changes.position`); roles pushed up along the way are not.

Errors: `400` for a malformed list - `invalid JSON` (not a list of `{"id", "position"}`), `invalid role id in list` (an `id` that is not a snowflake), `role positions must list from 1 to 250 roles, each once` (empty, more than 250 entries, a repeated id) - `400` `role position must be from 1 to 2147483397`, `400` `unknown role id` (a listed id that is not a role of the space), `400` `cannot move @everyone`, `403` `missing permission`, `403` `cannot manage a role or member at or above your own highest role`.

### `PATCH` /spaces/:id/roles/:roleId — *Manage Roles*

Any of the fields above plus `position`. `@everyone` can only have `permissions` changed; a role at or above your own highest is off limits. `position` (1 to 2147483397) **swaps** the role with the role holding that position, or, when no role holds it, puts the role there as sent; except for the owner it must be below your own highest role. When the move swapped another role, the space's roles arrive in one `SPACE_UPDATE` carrying `roles`. To reorder several roles, use [`PATCH /spaces/:id/roles`](#patch-spaces-id-roles-manage-roles) instead: one request, all or nothing.

### `DELETE` /spaces/:id/roles/:roleId — *Manage Roles*

Not `@everyone`, not a managed role, and except for the owner only a role below your own highest.

Errors for the role endpoints: `400` `role name must be 1-100 characters and not @everyone`, `400` `cannot rename or delete the @everyone role`, `400` `cannot move @everyone`, `400` `role position must be from 1 to 2147483397`, `400` `this role belongs to a bot and cannot be deleted or assigned`, `400` `a space can have at most 250 roles`, `403` `missing permission`, `403` `cannot grant permissions you do not have`, `403` `cannot manage a role or member at or above your own highest role`, `404` `role not found`.

### Room overrides — *Manage Roles*

- `GET /spaces/:id/rooms/:roomId/overrides` → `[{role_id, allow, deny}]`; `PUT …/overrides/:roleId` `{"allow", "deny"}`; `DELETE …/overrides/:roleId`.
- `GET /spaces/:id/rooms/:roomId/overrides/users` → `[{user_id, allow, deny}]`; `PUT …/overrides/users/:userId`; `DELETE …/overrides/users/:userId`.

Only room-scoped bits are accepted (see [Permissions › Room overrides](/docs/permissions/#room-overrides)). Listing needs View on the room. Deleting an override is bound by the same rule as writing one - removing a deny grants what the matching allow would - so you can only delete overrides whose bits you hold in that room (`403` otherwise).

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

## Emoji

### The emoji object

```json
{ "id": "…", "space_id": "…", "name": "party_blob", "url": "https://your-instance.example/cdn/v1/emojis/…/….png", "animated": false, "creator_id": "…", "created_at": "…", "updated_at": "…" }
```

Used in message text as `<:name:id>` (`<a:name:id>` when `animated`). A name is 2-32 letters, numbers or underscores, unique in its space ignoring case; surrounding colons are ignored. A space holds at most 50. Images are PNG, JPEG, GIF or WebP (judged by the file name's extension) up to 512 KB unless the instance changed it; a GIF is `animated`. Uploading, renaming and deleting need Manage Emojis (Manage Space or Administrator also do).

### `GET` /spaces/:id/emojis

The space's emoji (members only). `GET /emojis` lists the emoji of every space you are in; `GET /emojis/:emojiId` resolves one seen in a message from a space you may not be in.

### `POST` /spaces/:id/emojis — *Manage Emojis*

Multipart: `file` (the image) and `name`. Returns `201` with the emoji object. 10 per minute per account.

### `POST` /spaces/:id/emojis/bulk — *Manage Emojis*

Multipart: up to 10 `file` parts and as many `name` parts, paired in order (the first name is the first file's). Each image is checked and created exactly as by the single route - the same rules, one [`SPACE_EMOJI_CREATE`](/docs/gateway/#events) and one audit log entry per emoji - and one refusal does not stop the rest: the answer is `200` with a result per item, in request order:

```json
{
  "created": 1,
  "results": [
    { "index": 0, "name": "party_blob", "status": 201, "emoji": { "id": "…", "name": "party_blob", … } },
    { "index": 1, "name": "wave", "status": 400, "error": "an emoji with that name already exists in this space" }
  ]
}
```

Items past the space's free slots, and names already in the space or earlier in the same request, are refused without being uploaded. The whole request is refused (`400`) with no files, more than 10, or a different number of names than files, and (`403`) without the permission. 5 requests per minute per account, a budget separate from the single route's - enough to fill an empty space in a minute.

### `PATCH` /spaces/:id/emojis/:emojiId, `DELETE` /spaces/:id/emojis/:emojiId — *Manage Emojis*

`PATCH` takes `{"name"}`. Messages that used a deleted emoji show its `:name:` instead.

## Rooms

### `GET` /rooms

The account's private messages and group PMs.

### `GET` /rooms/:id

Any room the account can see, space rooms included - a space room is listed only when the account may view it. Space rooms carry `space_id`; every room carries `e2ee_enabled`.

### `POST` /rooms

Open a PM: `{"recipient_id": "…"}` (or `recipient_handle: "name"`), or a group: `{"name", "recipient_ids": [...]}`. Returns the room. PMs are end-to-end encrypted by default, so a bot can open one but cannot read it until the person turns encryption off for that PM.

A PM whose other account was [deleted](#deleted-accounts) keeps both participants - the other one as the `deleted` placeholder - so it never turns into a one-person room. It is read-only: messages answer `403` with `"code": "recipient_deleted"`.

### `POST` /rooms/:id/typing

Broadcast a typing indicator (rate limited to one per 5 s per room).

### `POST` /rooms/:id/ack

`{"message_id": "…"}` marks the room read up to that message (clears the caller's unread count and mention badge).

## Threads

A thread is a room of type `6` inside a text channel (Discord's model): started from a message - then it shares the message's id and the message carries `thread_id` - or on its own, public or private, with its own member list, an archive state that times out on its own, and a lock. Threads inherit the channel's permission overrides; four bits of their own apply (see [Permissions](/docs/permissions/)): Create Public Threads, Create Private Threads, Send Messages In Threads (Send Messages does not grant sending in a thread) and Manage Threads. Active threads the caller can see come in `READY.space_rooms` and `GET /spaces/:id/rooms` with a `thread` block: `{"archived", "archived_at", "locked", "private", "invitable", "auto_archive_minutes", "owner_id", "starter_message_id", "last_active_at", "message_count", "member_count", "joined"}`. Messages in a thread use the ordinary `/rooms/:thread_id/messages` endpoints.

### `POST` /rooms/:id/messages/:msg_id/threads — *Create Public Threads*

`{"name", "auto_archive_minutes"}` (60, 1440, 4320 or 10080; default 1440). `201` with the thread. The channel gets a `thread_created` system message.

### `POST` /rooms/:id/threads — *Create Public Threads, or Create Private Threads with `private`*

`{"name", "auto_archive_minutes", "private", "invitable"}`. A private thread starts with only its creator in it.

### `GET` /rooms/:id/thread, `PATCH` /rooms/:id/thread, `DELETE` /rooms/:id/thread

`PATCH` takes any of `{"name", "archived", "locked", "invitable", "auto_archive_minutes", "slowmode_seconds"}`. Name, archive state, auto-archive and invitable: Manage Threads or the thread's creator (unarchiving an unlocked thread: any member too). Lock and slowmode: Manage Threads. `DELETE`: Manage Threads. An archived thread only takes `archived: false` (a `locked` change may ride along); any other edit must unarchive in the same request or gets `400`. A message sent into an archived, unlocked thread unarchives it; a locked thread takes nothing from members without Manage Threads.

### Thread members

`GET /rooms/:id/thread-members` lists `[{"user_id", "joined_at", "user"}]`. `PUT` / `DELETE /rooms/:id/thread-members/@me` join and leave; `PUT` / `DELETE /rooms/:id/thread-members/:userId` add (any member of a public or invitable thread, else Manage Threads) and remove (Manage Threads or the creator). Posting in a thread, or being mentioned in one, joins it. Members are who gets unread and mention counts for the thread.

### `GET` /spaces/:id/threads/active, `GET` /rooms/:id/threads/archived

Every active thread in the space the caller can see, and a channel's archived threads (`?before=<RFC3339 archive time>&limit=`, newest first; private ones only for their members and Manage Threads holders). Both answer `{"threads": [...]}`, the archived list with `has_more`.

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
  "embeds": [ { "type": "rich", "title": "Deploy finished", "color": 3066993, "image": { "url": "https://…/cdn/…/chart.png", "proxy_url": "https://…/cdn/…/chart.png", "width": 1280, "height": 720 } } ],
  "reactions": [ { "emoji": "👋", "count": 1, "me": false } ],
  "pinned": true,
  "pinned_at": "2026-10-06T01:12:00.000Z",
  "pinned_by": "2102223172425220096",
  "created_at": "2026-09-30T03:44:47.421Z",
  "updated_at": "2026-09-30T03:44:47.421Z"
}
```

A message a [webhook](#webhooks) posted also carries:

```json
{
  "sender_id": "2106000000000000001",
  "webhook_id": "2106000000000000001",
  "masquerade": { "kind": "webhook", "name": "CI", "avatar": "https://your-instance.example/api/media/v1/external/…" },
  "author": { "id": "2106000000000000001", "username": "CI", "display_name": "CI", "avatar": "…", "bot": true, "webhook": true }
}
```

`sender_id` is then the webhook's id, not a user: there is no account to look up, message or mention. Show the message as `masquerade.name` with `masquerade.avatar` (the name and avatar it was posted under - renaming the webhook later does not change it; with no avatar, pick the [default avatar](#default-avatars) from `webhook_id`), and keep `author` - a compatibility copy with `bot: true` - out of any cache of users keyed by id: one webhook posts under many names.

A message a [bridge](#bridges) posted as a bridged user carries a `bridge` masquerade:

```json
{
  "sender_id": "2105141069376131072",
  "webhook_id": "2107000000000000009",
  "masquerade": {
    "kind": "bridge",
    "name": "Alice",
    "avatar": "https://your-instance.example/api/media/v1/external/…",
    "colour": 15158332,
    "bridge": {
      "id": "2107000000000000009",
      "name": "Discord #general",
      "platform": "discord",
      "platform_name": null,
      "puppet_id": "2107000000000000077",
      "external_bot": false,
      "profile_url": null
    },
    "lookalike": { "id": "2101000000000000042", "username": "alice" },
    "via": { "id": "2105141069376131072", "username": "strife", "display_name": "Strife", "avatar": "…", "bot": true }
  },
  "author": { "id": "2107000000000000077", "username": "Alice", "display_name": "Alice", "avatar": "…", "bot": true, "webhook": true }
}
```

`sender_id` is the bot that drives the bridge (`via`, its public user object); the person shown is someone on another platform, identified here only by `bridge.puppet_id` - a stable id per bridged user, never their id on that platform. Render it as `masquerade.name` followed by a platform tag (`DISCORD`, `MATRIX`, …, or `platform_name` for `other`) so it cannot pass for a member, with `masquerade.avatar` or the [default avatar](#default-avatars) picked from `puppet_id`. `colour` (0xRRGGBB) is present only when the bridge allows name colours, `profile_url` only when it shows profile links, and `lookalike` when a member of the space has the same name (say "Not the Strafe account @alice"). Two consecutive messages are the same author only when `webhook_id` and `puppet_id` match. As with webhooks, keep `author` out of user caches.

A published copy of an [announcement room](#announcement-rooms)'s message is posted by the following room's follower webhook. Its masquerade has `kind: "follow"`: `name` and `avatar` are the source space's, `via.webhook.name` is the source room (`"#news"`); show it with a tag saying it was published from there. It carries `flags: 2` and `message_reference: {"type": 0, "space_id", "room_id", "message_id"}` naming the original (with a `domain` when the original is on another instance and the ids are that instance's). A room that starts following gets a `room_followed` system notice, `system_payload` `{"actor_id", "space_name", "room_name"}`.

A [forward](#forwarding-messages) has no text of its own: `flags: 16384`, `message_reference: {"type": 1, "space_id"?, "room_id", "message_id"}` naming the source, and `message_snapshots: [{"message": {"content", "attachments", "embeds", "timestamp", "edited_timestamp", "flags"}}]` - a copy of the source as it was, with no author.

A bridge's arrival and removal leave a system notice in the room: `system_type` `bridge_created` or `bridge_deleted`, `system_payload` `{"bridge_id", "bridge_name", "platform", "platform_name"?, "remote_name"?, "driver_id", "driver_name", "actor_id"}`. `actor_id` is present whenever someone acted, the driving bot included: when it equals `driver_id` the bot did it itself ("Strife bridged this room"), otherwise a person did it through the bot. `driver_name` is left out once the bot's account is deleted.

`plaintext` is present in plain rooms; encrypted rooms carry `ciphertext` instead. `embeds` is always an array - a bot's rich embeds, empty when there are none and in every encrypted room; load their pictures from `proxy_url` / `proxy_icon_url` ([Embeds](/docs/embeds/#receiving-embeds)). `reactions` is included when fetching messages, not in gateway events; gateway events add `space_id` for a room in a space. `pinned`, `pinned_at` and `pinned_by` are present while the message is pinned in its room. Deleted messages keep their id with a `deleted_at`. System notices have `sender_id: "0"`, a `system_type` (`space_member_join`, `space_member_leave`, `space_birthday`, …) and a `system_payload`. `space_birthday` is posted once a day in the space's `birthday_channel_id` for each opted-in member whose birthday is that day (UTC); its payload is `{"user_id": "…", "message": "…"}`, with `message` being the space's `birthday_message` (possibly empty, meaning use the default greeting).

### `GET` /rooms/:id/messages

`?limit=` (default 50, ≤100) `&before=<message id>` for older history. Newest first. Needs **View Room** and **Read Message History** in the room.

In a space hosted on another instance, that instance answers this, `GET /rooms/:id/messages/:msg_id` and search. Its refusal reaches you with its status and fields, and this instance's own copy is served only when it cannot be reached; with no copy to serve, the answer is `502`.

### `GET` /rooms/:id/messages/:msg_id

### `POST` /rooms/:id/messages — *Send Messages*

See [Bots › Sending messages](/docs/bots/#sending-messages). `201` with the message. `embeds` (bots only, plain rooms only) also needs **Embed Links** in a space room; the object and its errors are on the [Embeds](/docs/embeds/) page. In a PM whose other account was deleted: `403` `this account no longer exists` (`code: "recipient_deleted"`).

### Forwarding messages

`POST /rooms/:id/messages` with `{"message_reference": {"type": 1, "room_id": "…", "message_id": "…"}}` (Discord's `channel_id` is accepted) and nothing else: no text, files, embeds or `reply_to_id` (`400` `forward_with_content` - send a comment as its own message). The server reads the source as you (**View Room** and **Read Message History** there) and copies it into `message_snapshots`: its text with mentions written out as names (`@alice`, `@moderators`, `#news`), so nothing in the copy pings or resolves anyone, its files and embeds, and when it was written and last edited - never who wrote it. Forwarding a forward copies its snapshot and keeps pointing at the original. The target needs **Send Messages**, plus **Attach Files** for files and **Embed Links** for embeds. A forward cannot be edited (`400` `forward_edit`), and is not updated when the source changes. Files are not copied: deleting the source deletes them.

End-to-end encryption: a source in an encrypted room can only be forwarded into an encrypted room (`403` `forward_from_encrypted`), and into an encrypted room the server builds nothing (`400` `forward_encrypted_target`) - the client puts the copy inside the ciphertext as `forward`, `{"content", "attachments", "embeds", "timestamp", "edited_timestamp", "source": {"room_id", "message_id", "space_id"}}`, which the server never sees. Other errors: `400` `forward_source` (a system notice, a deleted or empty message), `400` `invalid_message_reference` (any `type` but 1).

### `PATCH` /rooms/:id/messages/:msg_id

`{"plaintext": "…"}` - own messages only. A bot may also send `"embeds"`: a list replaces its embeds, `[]` or `null` removes them, and leaving the key out keeps them; `{"embeds": […]}` alone leaves the text as it is ([Embeds › Editing](/docs/embeds/#editing)).

### `DELETE` /rooms/:id/messages/:msg_id — *own, or Manage Messages*

### `GET` /rooms/:id/messages/search

`?q=<text>` `&has=link|file|image|video|audio` `&limit=`. Plain rooms only. `GET /spaces/:id/messages/search` searches every plain room of a space the caller can read.

### Reactions — *Add Reactions*

`PUT` / `DELETE` /rooms/:id/messages/:msg_id/reactions/:emoji, `GET …/reactions/:emoji` (who reacted; a bridged user's entry adds `puppet: {"bridge_id", "puppet_id", "platform", "platform_name"}`, `platform_name` being the label for their tag - show them as a bridged user, never look them up as a member). `:emoji` is a URL-encoded unicode emoji or `custom:<id>`. Custom emoji from other spaces need **Use External Emojis**.

### Pins — *Manage Messages in a space room; anyone in a PM or group*

`PUT` / `DELETE` /rooms/:id/messages/:msg_id/pin pin or unpin a message for everyone in the room (`204`, idempotent). A room holds at most 50 pins. Pinning posts a `message_pinned` system message whose `system_payload` names `actor_id` and `message_id`; every change fires [`ROOM_PINS_UPDATE`](/docs/gateway/#events). Deleting a message drops its pin.

`GET` /rooms/:id/pins — the room's pinned messages, newest pin first: `{"items": [{"pinned_at", "pinned_by", "message": {…}}], "has_more": false}`. Needs **View Room** and **Read Message History**.

### Announcement rooms

A space text room with `announcement: true` (set with [`PATCH /spaces/:id/rooms/:roomId`](#patch-spacesidroomsroomid--manage-rooms)) can be followed from other spaces, and its messages reach them only when someone publishes them - Discord's announcement channels. An announcement room is never end-to-end encrypted: turning either on while the other is answers `409` `announcement_encrypted`.

`POST /rooms/:id/followers` `{"webhook_room_id": "…"}` (`webhook_channel_id` is accepted) - follow the room into one of your rooms: you must be able to see the announcement room, and need **Manage Webhooks** in the target, a plain text room of a space hosted on this instance (`409` `managed_on_origin` otherwise; `409` `already_following`, `409` `webhook_limit`). It makes a [follower webhook](#the-webhook-object) (`type: 2`) there and returns `{"room_id", "webhook_id"}`. To unfollow, delete that webhook.

`POST /rooms/:id/messages/:msg_id/crosspost` - publish a message to every room following this one. Your own message needs **Send Messages**, anyone else's (a webhook's too) **Manage Messages**. Returns the message with `flags: 1`; publishing it again sends nothing more. A room publishes at most 10 messages an hour (`429` `publish_rate_limited`). Each following room gets a copy (see [the message object](#the-message-object)) that pings nobody. Editing the original edits every copy and deleting it deletes them - unlike Discord, where copies stay. Turning `announcement` off, or deleting the room or its space, removes every follower webhook.

In a space hosted on another instance, publishing is done there; following such a room into a room here registers the follow with that instance.

### `POST` /rooms/:id/attachments — *Send Messages*

`multipart/form-data` with `file` and optional `width`/`height`. Returns the attachment record; reference its `id` in a message within the same room. Size limit per the instance's configuration (25 MB on a default deployment).

## Webhooks

A webhook posts into one room through a secret URL - an incoming webhook, compatible with Discord's: a tool that posts to a Discord webhook (a CI job, a monitor, a GitHub Action) works by changing the host. Someone with **Manage Webhooks** in the room makes one; anything that holds its token can post. Webhook messages show the name and avatar the request gave, with a **WEBHOOK** tag, and nothing else a person has (no profile, PMs, roles or reactions of its own).

Webhooks live in a space's text rooms (and a voice room's text), **never in an end-to-end encrypted room**: creating one there is `409 room_encrypted`, and turning encryption on in a room disables its webhooks (`disabled_reason: "encrypted"`; executing then answers `403 room_encrypted`) until it is turned off again. Never in PMs or group PMs.

### The webhook object

```json
{
  "id": "2106000000000000001",
  "type": 1,
  "space_id": "2102443061534523000",
  "room_id": "2102443061534523392",
  "name": "CI",
  "avatar": "https://your-instance.example/cdn/v1/webhooks/2106…/a1b2c3.png",
  "application_id": null,
  "creator": { "id": "…", "username": "sam", "display_name": "Sam", "avatar": "…" },
  "mass_mentions": false,
  "disabled_reason": null,
  "created_at": "2026-11-17T12:00:00Z",
  "last_used_at": "2026-11-17T12:05:00Z",
  "token": "swh_…",
  "url": "https://your-instance.example/api/webhooks/2106000000000000001/swh_…"
}
```

- `type` `1` is an incoming webhook (Discord's type 1).
- `token` and `url` come back **only** from create and from a token reset - never from a list or a get (Discord returns them forever; Strafe does not). Store the URL when you get it; if you lose it, reset it.
- `application_id` is set when a bot made it: that bot may manage it without Manage Webhooks, and execute it with its own bot token.
- `creator` is left out of answers to token-authenticated requests.
- `mass_mentions`: whether the webhook may ping `@everyone`, `@here` and roles at all. Off by default, and only someone with **Mention @everyone** in the room can turn it on - stricter than Discord, where a leaked webhook URL is a mass-ping weapon.
- Tokens start with `swh_`, so secret scanners can spot one that leaked.

### Managing webhooks

All of these take a session or a bot token (not an OAuth2 access token); mutations take an optional `reason` for the [audit log](#get-spaces-id-audit-log-manage-space) and fire [`WEBHOOKS_UPDATE`](/docs/gateway/#rooms) to the room's viewers.

| Method + path | Who | Body / answer |
| --- | --- | --- |
| `POST /rooms/:id/webhooks` | Manage Webhooks in the room | `{"name", "avatar"?, "mass_mentions"?, "reason"?}` → `201`, the webhook **with `token` and `url`** |
| `GET /rooms/:id/webhooks` | Manage Webhooks in the room | the room's webhooks (no tokens) |
| `GET /spaces/:id/webhooks` | Manage Webhooks somewhere in the space | the webhooks of the rooms where you have it |
| `GET /webhooks/:id` | Manage Webhooks in its room, or its owning bot | the webhook |
| `PATCH /webhooks/:id` | as above | `{"name"?, "avatar"?, "room_id"?, "mass_mentions"?, "reason"?}`. `room_id` moves it to another plaintext room of the same space (Manage Webhooks in both); `avatar: null` clears it |
| `DELETE /webhooks/:id` | as above | `204` |
| `POST /webhooks/:id/token` | as above | `200`, the webhook with a **new** `token` and `url`; the old one stops working at once |
| `GET /webhooks/:id/:token` | the token | the webhook, without `creator` |
| `PATCH /webhooks/:id/:token` | the token | `{"name"?, "avatar"?}` only |
| `DELETE /webhooks/:id/:token` | the token | `204` - so whoever finds a leaked URL can kill it |

`name` is 1-80 characters. It cannot be a reserved name (`Strafe`, `system`, `everyone`, `admin`, `moderator`, …, and the instance's official account), the name of one of the space's owner or moderators, or the name of a role in the space (`400 invalid_name` with a `reason`: `empty`, `length`, `characters`, `reserved`, `staff`, `role`). Names are compared ignoring case, width, accents, invisible characters and letters of other scripts that look like Latin ones (a Cyrillic `а` counts as `a`); control characters, line breaks and bidi embedding/override/isolate controls are refused (`characters`). The same rule applies to a message's `username`. `avatar` is a `data:image/png|jpeg|gif|webp;base64,…` URI (Discord's form) within the avatar size limit (`400 invalid_avatar` otherwise).

At most 15 webhooks per room and 200 per space (`409 webhook_limit` with `max`); an instance can change both (`WEBHOOKS_PER_ROOM`, `WEBHOOKS_PER_SPACE`).

A **follower webhook** (`type: 2`) is a follow of an [announcement room](#announcement-rooms), made with `POST /rooms/:id/followers`. It is listed with the room's webhooks and adds `source: {"label": "Space #room", "space_id", "room_id", "domain"?}` (the ids as the instance hosting the announcement room names them). It has no token: it cannot be executed, its token cannot be reset (`400 unsupported_field`), it cannot move to another room or ping anyone, and deleting it is unfollowing. Followers count toward the limits above.

### Executing a webhook

`POST /webhooks/:id` with the header `Authorization: Webhook <token>` - preferred, since it keeps the token out of URLs and logs - or `POST /webhooks/:id/:token`, Discord's form. The owning application's bot may also use `Authorization: Bot <token>`. No session, no CORS.

Query parameters:

| Parameter | Meaning |
| --- | --- |
| `wait` | `false` (default): answer `204` without the message, as Discord does. `true`: answer `200` with the [message](#the-message-object) |
| `thread_id` | Post into a thread of the webhook's room. An archived thread is unarchived; a locked one is `403 thread_locked`; a thread elsewhere is `400 thread_not_in_room` |

The body is JSON, or `multipart/form-data` with a `payload_json` part and `files[0]`, `files[1]`, … parts (Discord's form):

| Field | Notes |
| --- | --- |
| `content` | Up to 4000 characters. Mentions in it are parsed by the server, then filtered by `allowed_mentions` |
| `username` | Show the message under this name instead of the webhook's (1-80, the name rules above) |
| `avatar_url` | Show it with this picture: an `https://` URL up to 512 characters, or `attachment://<filename>` of a file in the same request. Readers load it through the instance's image proxy, never from your server |
| `embeds` | Up to 10 [embeds](/docs/embeds/), with the same limits as a bot's. A webhook needs no Embed Links bit |
| `allowed_mentions` | Discord's object: `{"parse": ["users", "roles", "everyone"], "users": [ids], "roles": [ids], "replied_user": false}`. `parse` lists the kinds that notify; `users` / `roles` whitelist ids (up to 100 each; naming a kind in `parse` and listing ids for it is `400 invalid_allowed_mentions`). Leaving it out means all three kinds; `{}` notifies nobody. On top of it, `everyone` and `roles` notify only when the webhook has `mass_mentions`. A mention that does not notify stays in the text |
| `files[n]`, `attachments` | Uploads, stored like any room upload (same per-file limit), up to 10 |
| `flags` | `4096` (SUPPRESS_NOTIFICATIONS: no mention badges, no push) and `4` (SUPPRESS_EMBEDS, accepted and ignored - link previews are drawn by clients). Anything else is `400 unsupported_field` |
| `tts`, `components` | Accepted and ignored |
| `poll`, `thread_name`, `applied_tags` | `400 unsupported_field` (no polls or forum rooms) |

At least one of `content`, `embeds` or a file (`400 empty_message`). A webhook is the room manager's own integration, so - as on Discord - it skips slowmode, verification levels and automod; it still cannot post into an encrypted room.

```sh
# Preferred: the token in a header
curl -X POST "https://your-instance.example/api/webhooks/$WEBHOOK_ID?wait=true" \
  -H "Authorization: Webhook $WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Build #42 passed", "username": "CI", "allowed_mentions": {"parse": []}}'

# Discord's form: the whole URL, as Discord tools expect it
curl -X POST "$WEBHOOK_URL" -H "Content-Type: application/json" -d '{"content": "Deploy finished"}'

# A file, with an embed that shows it
curl -X POST "https://your-instance.example/api/webhooks/$WEBHOOK_ID" \
  -H "Authorization: Webhook $WEBHOOK_TOKEN" \
  -F 'payload_json={"embeds": [{"title": "Coverage", "image": {"url": "attachment://coverage.png"}}]}' \
  -F 'files[0]=@coverage.png'
```

In a GitHub Actions workflow, keep the URL in a repository secret:

```yaml
- name: Tell the room
  if: always()
  run: |
    curl -sS -X POST "${{ secrets.STRAFE_WEBHOOK_URL }}" \
      -H "Content-Type: application/json" \
      -d "{\"content\": \"${{ github.workflow }} on ${{ github.ref_name }}: ${{ job.status }}\", \"allowed_mentions\": {\"parse\": []}}"
```

### GitHub repository webhooks

A GitHub repository or organization webhook can post straight into a room. In GitHub's webhook settings, paste the webhook's URL as the **Payload URL**, as it is or with `/github` on the end (`POST /webhooks/:id/:token/github`, Discord's form). Either content type works. A request that carries GitHub's `X-GitHub-Event` header is read as a GitHub delivery, and each event becomes one embed under the webhook's name and avatar, which never pings anyone.

| Event | Posted |
| --- | --- |
| `push` | New commits (up to five listed). A push with no commits is not posted |
| `pull_request` | Opened, closed, merged, reopened, ready for review |
| `pull_request_review`, `pull_request_review_comment` | Approvals, requested changes, reviews with text, review comments |
| `issues`, `issue_comment`, `commit_comment` | Issues opened, closed and reopened, and new comments |
| `discussion`, `discussion_comment` | New discussions and comments |
| `release` | Published releases and pre-releases |
| `create`, `delete` | Branches and tags |
| `workflow_run` | Every finished workflow run with its result (skipped runs are not posted) |
| `check_run` | Failed, timed-out and action-needed checks only. There is one per CI job, so `workflow_run` is the one to subscribe to for every result |
| `fork`, `watch`, `member`, `public` | Forks, stars, new collaborators, a repository made public |

Any other event, and the parts of these that are not posted, is answered `200 {"posted": false, "event", "reason"}`, so GitHub's delivery log says why nothing appeared. A `ping` is answered the same way. A wrong token is `401` as usual. GitHub's `X-Hub-Signature-256` is not checked: the token in the URL is the credential, so leave GitHub's *Secret* empty or set it to anything.

### A webhook's own messages

| Method + path | Notes |
| --- | --- |
| `GET /webhooks/:id/:token/messages/:message_id` | Only a message this webhook posted (`404 unknown_message` otherwise); `thread_id` for one in a thread |
| `PATCH /webhooks/:id/:token/messages/:message_id` | `content`, `embeds`, `allowed_mentions`, `attachments` (the files to keep) and new `files[n]`. Mentions are parsed and filtered again. Fires `MESSAGE_UPDATE` |
| `DELETE /webhooks/:id/:token/messages/:message_id` | `204`, `MESSAGE_DELETE` |

All three also work as `/webhooks/:id/messages/:message_id` with `Authorization: Webhook <token>`. Moderators delete webhook messages with the ordinary [delete](#delete-rooms-id-messages-msg-id-own-or-manage-messages) (Manage Messages).

### Webhook errors and limits

| Status | `code` | When |
| --- | --- | --- |
| `400` | `invalid_name` (+`reason`), `invalid_avatar`, `invalid_allowed_mentions`, `unsupported_field` (+`field`), `empty_message`, `invalid_embed` (+`path`), `thread_not_in_room` | The request |
| `401` | `invalid_webhook_token` | A wrong or reset token. Limited to 30 failures a minute per address |
| `403` | `missing_permissions` (+`permission`), `room_encrypted`, `thread_locked` | |
| `404` | `unknown_webhook`, `unknown_message` | |
| `409` | `webhook_limit` (+`max`), `room_encrypted` | Creating |
| `429` | `rate_limited` (+`retry_after` in seconds, `scope`: `webhook` or `room`) | Executes: 5 per 2 seconds per webhook, and 30 per 10 seconds per room shared by every webhook in it. Edits and deletes: 30 per minute per webhook |

Treat a webhook URL like a password. If one leaks - a screenshot, a public repository, a log - reset it (`POST /webhooks/:id/token`) or delete it; anyone holding it can post as the webhook, edit and delete its messages, rename it, or delete it.

## Bridges

A bridge connects a room to a room on another platform - Discord, Matrix, IRC, Telegram, Slack, XMPP, Revolt or another one. A **bot** drives it: it posts what people say over there into the room as **bridged users**, and reads the room's messages back from a filtered [feed](/docs/gateway/#bridge-feed) to post them on the other side. This is Strafe's take on Revolt's *masquerade* (a per-message name, avatar and colour), made strictly for bridging: a bridged message always relays something that exists elsewhere (an external user id and message id), always shows its platform tag and its real sender, can never ping `@everyone` or roles, and never exists in an end-to-end encrypted room. There is no masquerade on an ordinary message.

The server does the bookkeeping a bridge used to need its own database for: the external-id ↔ Strafe-message map (so you edit, delete, reply and react by the other platform's ids, and retries are idempotent), the room's rules applied to each bridged user, moderator blocks, loop prevention and people's consent.

Bridges live in a space's text rooms (type `3`), not in threads, voice rooms or encrypted rooms. Token-driven bridges (bridge software with no bot account) are not available yet: today every bridge is driven by the bot that created it.

### The bridge object

```json
{
  "id": "2107000000000000009",
  "type": 4,
  "space_id": "2102443061534523000",
  "room_id": "2102443061534523392",
  "name": "Discord #general",
  "avatar": null,
  "platform": "discord",
  "platform_name": null,
  "remote": { "name": "Example Server #general", "url": "https://discord.com/channels/1/2" },
  "driver": "bot",
  "application_id": "2105141069376131072",
  "creator": { "id": "2105141069376131072", "username": "strife", "bot": true },
  "state": "active",
  "state_reason": null,
  "settings": {
    "relay_bots": false,
    "relay_other_bridges": false,
    "reply_pings": true,
    "allow_colour": false,
    "show_profile_links": false
  },
  "created_at": "2026-11-17T12:00:00Z"
}
```

- `platform` is one of `discord`, `matrix`, `irc`, `telegram`, `slack`, `xmpp`, `revolt`, `other`; `other` needs `platform_name` (1-32, shown on the tag: "Mastodon").
- `remote` is what the room is bridged with (name 1-100, an optional `https://` URL). The bot declares it; clients show it as the bridge's own description.
- `state` is `active`, `paused` or `disabled`, and `state_reason` says why it is not running: `paused_by_manager`, `paused_by_driver` (the bot paused its own bridge; it may resume it, and so may the room's managers), `became_private` (the room stopped being open to everyone; someone resumes it with the acknowledgement), `driver_lost_permission` (the bot no longer has View Room, Send Messages or Masquerade there; it resumes by itself once it does) or `encrypted` (disabled while the room is end-to-end encrypted; turning encryption off leaves it paused).
- `settings`: `relay_bots` (copy bots' and webhooks' messages to the platform), `relay_other_bridges` (copy what other bridges post here - off, so a room bridged to Discord and Matrix does not cross-feed), `reply_pings` (a bridged reply may notify the person it answers), `allow_colour` (bridged users may carry a name colour; turning it on needs **Manage Roles**), `show_profile_links` (cards offer the bridged user's profile on their platform).

Everyone who can view the room gets the public **summary** - `{id, platform, platform_name, name, remote, state, state_reason, driver_name, driver_id, room_id, created_at}` - from `GET /rooms/:id/bridges`, from each room's `bridges` list in [`READY`](/docs/gateway/#ready), and from the [`BRIDGE_CREATE` / `BRIDGE_UPDATE` / `BRIDGE_DELETE`](/docs/gateway/#rooms) events. A room is never bridged silently.

### Creating and managing bridges

| Method + path | Who | Body / answer |
| --- | --- | --- |
| `POST /rooms/:id/bridges` | A bot with **Manage Webhooks** and **Masquerade** in the room | `{"platform", "platform_name"?, "name", "avatar"?, "remote"?, "settings"?, "acknowledge_private"?, "reason"?}` → `201`, the bridge. The bot drives it; the room gets the `bridge_created` notice |
| `GET /rooms/:id/bridges` | Anyone who can view the room | the summaries |
| `GET /bridges/:id` | Manage Webhooks in its room, or its bot | the bridge |
| `PATCH /bridges/:id` | Manage Webhooks, or its bot for `name`, `avatar`, `remote` and `state` | `{"name"?, "avatar"?, "remote"?, "settings"?, "state"?: "active" \| "paused", "acknowledge_private"?, "reason"?}`. `allow_colour: true` needs Manage Roles. A bridge cannot move to another room: people agreed to this one |
| `DELETE /bridges/:id` | Manage Webhooks, or its bot | `204`; the room gets the `bridge_deleted` notice |

A room that not everyone in the space can see needs `acknowledge_private: true` to be bridged or resumed: without it the answer is `409 private_room_ack_required` with `audience` (how many people can see it). A room that becomes private later pauses its bridges (`became_private`). An encrypted room refuses with `409 room_encrypted`. At most 3 bridges per room and 20 per space, counted among the room's 15 webhooks (`409 bridge_limit` with `max`). When the bot leaves the space or its application is deleted, its bridges are deleted with it.

### Posting as a bridged user

`POST /bridges/:id/messages` with the driving bot's token (`Authorization: Bot <token>`). The bot must hold View Room, Send Messages and Masquerade in the room at that moment. `wait` defaults to `true` here.

```json
{
  "external_user": {
    "id": "81726354",
    "name": "Alice",
    "avatar_url": "https://cdn.discordapp.com/avatars/81726354/ab12.png",
    "colour": null,
    "bot": false,
    "profile_url": "https://discord.com/users/81726354"
  },
  "external_message_id": "1300000000000000",
  "part": 0,
  "content": "hello from discord",
  "embeds": [],
  "reply_to": { "external_message_id": "1299999999999999" },
  "allowed_mentions": { "replied_user": true }
}
```

| Field | Notes |
| --- | --- |
| `external_user.id` | Required, 1-128 printable characters: who on the other platform said it. Never shown to readers |
| `external_user.name` | 1-32 characters after the [name rules](#managing-webhooks) (no reserved, moderator or role names). A member's name is allowed; clients then say it is not that member |
| `external_user.avatar_url` | `https://`, up to 512 characters, or `attachment://<filename>`. Readers load it through the instance's image proxy |
| `external_user.colour` | 0xRRGGBB, only when the bridge has `allow_colour` |
| `external_user.bot`, `profile_url` | A bot on the other platform; their profile (`https://`, shown only with `show_profile_links`) |
| `external_message_id` | Required, 1-256 printable ASCII: the message on the other platform. With `part` (0-9, one external message as several Strafe messages) it makes the send **idempotent**: a retry of the same pair answers `200` with the existing message and `"duplicate": true` |
| `content`, `embeds`, files | As for [executing a webhook](#executing-a-webhook). Embeds and files also need `@everyone` to have Embed Links / Attach Files in the room |
| `reply_to` | `{"external_message_id", "part"?}` (a message this bridge posted or [linked](#external-message-ids)) or `{"message_id"}` (any message in the room). An unknown one sends without the reply and answers `"reply_dropped": true` |
| `allowed_mentions` | Only `replied_user` counts, and only when the bridge has `reply_pings`. A bridge never pings `@everyone`, `@here` or roles; any `<@id>` in the text renders but notifies nobody |

The answer is the [message](#the-message-object) plus `{"puppet_id", "duplicate"?, "reply_dropped"?}`. The first message from a new `external_user.id` mints the bridged user's `puppet_id`; later ones update their last-known name and avatar. Each message keeps the name and avatar it was sent with.

| Method + path | Notes |
| --- | --- |
| `GET /bridges/:id/puppets/:external_user_id` | The bridged user: `puppet_id`, name, avatar, `blocked` |
| `PATCH /bridges/:id/puppets/:external_user_id` | Update the name or avatar for future messages |
| `DELETE /bridges/:id/puppets/:external_user_id` | Forget them now (a privacy request on the other platform): the record and its id-map entries go; their messages stay with the name they were sent under |

### External message ids

Both directions are kept, ids only and never text, for `BRIDGE_MAP_TTL_DAYS` (30 by default) after each message, and removed at once with the bridge or the bridged user.

| Method + path | Notes |
| --- | --- |
| `PUT /bridges/:id/messages/:message_id/external` | `{"external_message_id", "part"?}`: you copied this Strafe message to the platform under that id (`204`; `409 external_message_conflict` if the id already maps elsewhere). Replies to the copy then resolve, and its edits, deletes and reactions reach your feed with the external ids |
| `GET /bridges/:id/messages/external/:external_message_id` | `{"message_id", "room_id", "part", "direction": "inbound" \| "outbound", "external_message_id", "parts": [...]}`: the top-level fields are the lowest part's entry, and `parts` lists every part's entry (same shape, without `parts`), lowest first - a message split in several Strafe messages has one per part. `404 unknown_external_message` when nothing maps |
| `GET /bridges/:id/messages/:message_id/external` | The external ids of a Strafe message: an array of `{"message_id", "room_id", "part", "direction", "external_message_id"}` |
| `PATCH /bridges/:id/messages/external/:external_message_id` | `{"content"?, "embeds"?, "part"?}` - edit a message this bridge posted; `MESSAGE_UPDATE` |
| `DELETE /bridges/:id/messages/external/:external_message_id` | Every part (or `?part=`); `MESSAGE_DELETE`. `404 unknown_external_message` once the entry expired |
| `PUT` / `DELETE /bridges/:id/messages/external/:external_message_id/reactions/:emoji/:external_user_id` | The bridged user reacts or withdraws it. Also `/bridges/:id/messages/:message_id/reactions/…` for a Strafe message. `@everyone` needs Add Reactions (and Use External Emojis); custom emoji must be the space's own |

A Strafe id works in place of `external/:external_message_id` in every path (`/bridges/:id/messages/:message_id`).

### Room rules for bridged users

A bridged user may do what a member with no roles may do in the room, and no more than the bot itself:

| Rule | For bridged users |
| --- | --- |
| `@everyone` cannot send in the room | `403 puppet_cannot_send` (the bridge becomes one-way) |
| `@everyone` lacks Attach Files, Embed Links or Add Reactions | Files, embeds or reactions refused: `403 missing_permissions` with `permission` |
| Slowmode, automod content rules | Applied to each bridged user on their own |
| Verification level | Not applied (there is no Strafe account to be old enough); enforce your platform's own |
| Moderator block | `403 puppet_blocked` |
| Rate | Per bridge 50 sends per 10 s and 100 edits, deletes and reactions per 10 s; per bridged user 5 per 5 s; plus the room's 30 per 10 s shared with webhooks (`429 rate_limited` with `scope`: `bridge`, `puppet` or `room`) |

### Blocking a bridged user

| Method + path | Who | Notes |
| --- | --- | --- |
| `PUT /bridges/:id/blocks/:puppet_id` | Kick Members, or Manage Messages in the room | `{"reason"?}`. Their sends, edits and reactions through this bridge are refused from now on; audit-logged; the bot gets [`BRIDGE_PUPPET_BLOCK`](/docs/gateway/#bridge-feed) so it can say so on the other side |
| `DELETE /bridges/:id/blocks/:puppet_id` | same | Unblock |
| `GET /bridges/:id/blocks` | same | The blocks, newest first: `{puppet_id, name, avatar, reason, blocked_at, blocked_by}` |

Moderators delete bridged messages with the ordinary [delete](#delete-rooms-id-messages-msg-id-own-or-manage-messages); the bot hears it as `BRIDGE_MESSAGE_DELETE` with `by_moderator: true`.

### Loops and the feed

Every message a bridge posts has `webhook_id` and `masquerade.kind: "bridge"`; every webhook message has `webhook_id`. A bot that is not a bridge should skip messages with `webhook_id` (strafe.js: `message.webhookId`, `message.isBridged`).

A bridge's bot also still receives the ordinary `MESSAGE_CREATE` events of a room it is in, but a bridge must copy only what its [feed](/docs/gateway/#bridge-feed) gives it: the feed is already filtered (people who said no, the bridge's own messages, other bridges and bots unless the settings say so, system notices, threads, anything from before the bridge existed). After downtime, catch up with `GET /bridges/:id/messages?after=<message id>&limit=100`: the same filtered `BRIDGE_MESSAGE_CREATE` payloads, oldest first (Read Message History applies).

### Bridges and privacy

A bridge copies a room's messages to a third party, under that platform's terms. So:

- **People decide.** Each person has an account default - *Settings › Privacy › Bridges*, "Let bridges copy my messages to other platforms" - and a per-space choice in the space's menu (*Bridge privacy*: use my default, allow, don't allow). A space is in **opt-out** mode (everyone is copied unless they said no; the default) or **opt-in** mode (only people who said yes for that space); Manage Space switches it, and it is audit-logged. The effective answer for a person in a space is their per-space choice, else "no" if their account default is off, else the space's mode.
- **The server enforces it**, on the feed, before anything reaches the bot. The bot never gets a list of who said no; when someone switches to "no", it gets one `BRIDGE_OPTOUT` with the external ids of that person's messages it copied, so it can delete those copies.
- **Members of other instances** in a federated space are left out of every bridge's feed until their own instance can say what they chose.
- **Never silent**: the room shows a "Bridged: Discord" badge (what it is bridged with, by which bot, and whether *your* messages are copied), a notice when a bridge arrives or goes, and a one-line hint over the composer the first time you post there.
- **What is stored**: the bridge's configuration; on each bridged message, the name, avatar URL, platform and bridged-user id it was sent with; per bridged user, their external id, last name, avatar and profile link and any block, until 90 days without a message (`BRIDGE_PUPPET_TTL_DAYS`), until the bot forgets them, or until the bridge goes; the id map for 30 days (`BRIDGE_MAP_TTL_DAYS`); people's consent choices until they change them or delete their account. Pictures from other platforms load only through the instance's image proxy, so readers' browsers never contact that platform. External user ids are never shown to readers; moderators act on `puppet_id`.

| Method + path | Who | Body / answer |
| --- | --- | --- |
| `GET /users/@me/bridge-consent` | You | `{"default": "allow" \| "deny" \| null}` (null: never set) |
| `PUT /users/@me/bridge-consent` | You | `{"default": "allow" \| "deny"}` |
| `GET /spaces/:id/members/@me/bridge-consent` | A member | `{"state": "inherit" \| "allow" \| "deny", "mode": "optout" \| "optin"}` |
| `PUT /spaces/:id/members/@me/bridge-consent` | A member | `{"state": "inherit" \| "allow" \| "deny"}`. Turning it to `deny` sends `BRIDGE_OPTOUT` to the space's bridges |
| `PUT /spaces/:id/bridge-consent` | Manage Space | `{"mode": "optout" \| "optin"}` |

### Bridge errors and limits

| Status | `code` | When |
| --- | --- | --- |
| `400` | `invalid_platform`, `invalid_name` (+`reason`), `invalid_avatar`, `empty_message`, `invalid_embed` (+`path`) | The request |
| `403` | `missing_permissions` (+`permission`), `room_encrypted`, `bridge_inactive` (+`state`, `state_reason`), `puppet_cannot_send`, `puppet_blocked` | |
| `404` | `unknown_bridge`, `unknown_message`, `unknown_external_message`, `unknown_puppet` | |
| `409` | `bridge_limit` (+`max`), `private_room_ack_required` (+`audience`), `external_message_conflict`, `room_encrypted` | |
| `429` | `rate_limited` (+`retry_after`, `scope`: `bridge`, `puppet`, `room`) | See [Room rules](#room-rules-for-bridged-users) |

## GIFs

The instance proxies GIF search, so the provider's API key stays on the server and the search request comes from the instance, never from the person searching: not their address, cookies or account. The GIFs themselves (`url`, `preview_url`, `still_url`) are served by the provider's CDN, so whatever loads them is seen by the provider. Trending pages are cached for two minutes; searches are passed straight through and not cached.

### `GET` /gifs/search, `GET` /gifs/trending

| Parameter | |
| --- | --- |
| `provider` | `giphy` (the default) or `heypster` - one of `features.gifs.providers` on `GET /` |
| `q` | Search only, and required there. Trimmed, and cut to 50 characters |
| `limit` | 1-50, default 24 |
| `offset` | 0-4999, default 0 |

Results are rated up to PG-13.

```json
{ "results": [{ "id": "…", "title": "…", "url": "https://…/giphy.gif", "width": 480, "height": 270, "preview_url": "https://…/200w.gif", "preview_width": 200, "preview_height": 113, "still_url": "https://…/200w_s.gif" }], "next_offset": 24, "total_count": 1000 }
```

`url` is the rendition to send or embed, `preview_url` a smaller animated one for a picker grid, and `still_url` (absent when the provider has none) a single frame to show while it loads. Every URL is `https://`; an item without a usable preview and full rendition is left out, so a page can hold fewer than `limit`. Pass `next_offset` as `offset` for the next page, and stop once it reaches `total_count`.

## Image proxy

### `GET` /media/v1/external/:sig/:src — *no auth*

Serves the instance's copy of a picture from elsewhere: the addresses message objects give as an embed's `proxy_url` / `proxy_icon_url` ([Embeds › Images](/docs/embeds/#images)). Do not build these yourself; the signature is what lets a request through, and only the instance can make one. On an instance without a configured public URL, `proxy_url` is a path starting with `/media/v1/`: resolve it against your API base.

A success is the image (png, jpeg, gif or webp, its type judged from the bytes) with `Cache-Control: public, max-age=86400`, `X-Content-Type-Options: nosniff` and a sandboxing `Content-Security-Policy`. Errors are `{"error": "…"}`:

| Status | |
| --- | --- |
| `400` | A bad or forged signature |
| `404` | The source has no such picture |
| `413` | Larger than the instance's size limit (8 MB by default) |
| `415` | Not a png, jpeg, gif or webp, or more than 16384 pixels a side |
| `502` | The source could not be reached or did not answer properly |
| `429` | Too many uncached fetches from one address (more than 60 a minute); see `Retry-After` |

`404`, `413`, `415` and `502` are remembered for 15 minutes and sent with `Cache-Control: public, max-age=900`.

| Status | Body | When |
| --- | --- | --- |
| `400` | `{"error": "unknown gif provider", "code": "gif_provider_unknown"}` | `provider` is neither `giphy` nor `heypster` |
| `400` | `{"error": "query is required"}` | `q` is empty on `/gifs/search` |
| `404` | `{"error": "gif provider not configured", "code": "gif_not_configured"}` | The instance has no key for that provider |
| `502` | `{"error": "gif provider unavailable", "code": "gif_upstream"}` | The provider failed or answered with an error |
| `503` | `{"error": "gif provider unavailable", "code": "gif_upstream"}` | The provider is rate limiting the instance; try again later |

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

## Key backup (session only)

The end-to-end encryption key backup (`m.megolm_backup.v1.curve25519-aes-sha2`, the same shape as Matrix's `/room_keys`). The server stores room keys encrypted to the backup's public key and the private key wrapped under the user's recovery code; it can read neither. Only a person's session may call these.

| Method and path | |
| --- | --- |
| `POST` /devices/backup/version `{"algorithm", "auth_data", "wrapped_private_key", "salt", "password"}` | Start a new version; returns `{"version"}`. `password` is the account password, checked again: `400 password is required` without it, `403 invalid password` when wrong. The version this one replaces is kept, keys included, for **7 days** so a replacement the user did not make can be undone; anything older is removed. Fires `KEY_BACKUP_UPDATE` |
| `GET` /devices/backup/version | The current version's public parameters: `{"exists", "version", "algorithm", "auth_data", "etag", "count", "created_at"}`, plus `"previous": {"version", "created_at"}` while a superseded version is still retained (absent otherwise) |
| `GET` /devices/backup/recovery`[?version=N]` | The wrapped private key and salt for a restore. Without `version`, the current one; with it, the current or the retained previous version only - anything else is `404` |
| `DELETE` /devices/backup/version?version=N `{"password"}` | Discard a version and every key in it, immediately; takes the password the same way as `POST`. Deleting the current version makes the retained previous one current again. Fires `KEY_BACKUP_UPDATE` |
| `PUT` /devices/backup/keys?version=N | Upload room keys to the **current** version; a superseded one answers `404`, which is how a device that missed `KEY_BACKUP_UPDATE` learns the version moved |
| `GET` /devices/backup/keys?version=N`[&after=<cursor>]` | One page of a version's keys - the current or the retained previous one |

## Errors

```json
{ "error": "missing permission to send messages in this channel" }
```

| Status | When |
| --- | --- |
| `400` | Invalid JSON, a missing or invalid field, an id that is not a snowflake; OAuth2 `invalid_*` errors. A refused embed adds `"code": "invalid_embed"` and the `path` of the field, e.g. `"embeds[0].fields[3].value"` ([Embeds › Errors](/docs/embeds/#errors)). A permission written as a string with a bit the instance does not know: `unknown_permission_bits` |
| `401` | No credential, or an invalid / expired / reset one |
| `403` | Not a member, missing permission, role hierarchy, banned, an OAuth2 token without the needed scope (`insufficient_scope`), or a PM whose other account was deleted (`recipient_deleted`) |
| `404` | No such space / room / message / role, or one you cannot see |
| `409` | A conflict (an application that already has a bot, the application limit) |
| `429` | Rate limited or slowmode; see below |
| `500` | Something broke server-side. Retry with backoff |
| `502`, `503` | A service the instance relays to (a GIF provider, or the instance hosting a space) failed or is limiting the instance. Retry later |

## Rate limits

| What | Limit |
| --- | --- |
| `POST /oauth2/token`, `POST /oauth2/token/revoke` | 20 per minute per IP |
| Creating applications, secrets and bot tokens | 20 per minute |
| Typing indicators | One broadcast per 5 s per room (extra calls succeed silently) |
| `GET /gifs/search`, `GET /gifs/trending` | 60 per minute per account, each |
| Gateway `op 2` frames | Burst of 20 per connection, refilling one every 250 ms |
| Webhooks | Executing: 5 per 2 s per webhook and 30 per 10 s per room; editing or deleting its messages: 30 per minute per webhook; failed token checks: 30 per minute per address. See [Webhooks](#webhook-errors-and-limits) |
| Bridges | Per bridge 50 sends and 100 edits, deletes and reactions per 10 s; per bridged user 5 per 5 s; the room's 30 per 10 s shared with webhooks. See [Bridges](#room-rules-for-bridged-users) |
| Messages in a room with slowmode | One per `slowmode_seconds` per member; `429` with `retry_after` (seconds) and a `Retry-After` header. Members with Manage Messages are exempt |
| Custom emoji uploads | Per account: 10 per minute `POST /spaces/:id/emojis`, 5 per minute `POST /spaces/:id/emojis/bulk` (up to 10 images each) |
| Space member profiles | Per account: 60 per minute reading one member, 20 per minute `PATCH`, 10 per minute image uploads |
| Member roles (`PUT …/members/:userId/roles`, `PUT` / `DELETE …/members/:userId/roles/:roleId`) | 120 per minute per account |
| Sign-in, registration, key backup | Separate tight limits (not relevant to bots) |

Other endpoints are not individually limited today; be a good citizen anyway - batch what you can, cache what does not change, and back off on `429` and `5xx`.
