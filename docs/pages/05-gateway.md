---
title: Gateway
description: The WebSocket protocol - connecting, opcodes, the READY payload, heartbeat, subscriptions, and a reference of every event with its payload.
---

# Gateway

The gateway ("Stargate") is the real-time side of the API: one WebSocket connection over which the server pushes every event the connected account can see. Bots and clients use the same protocol.

This instance's gateway: <code data-instance="gateway">wss://your-instance.example/gateway/events</code>

## Connecting

Open a WebSocket to the gateway URL with the credential in the handshake:

```http
GET /gateway/events HTTP/1.1
Host: your-instance.example
Authorization: Bot <bot token>
Upgrade: websocket
```

- Bots send `Authorization: Bot <token>`. Bot tokens are accepted from the header **only** - never in the URL, where they would end up in logs.
- The Strafe client uses its session token (`Authorization: Bearer`, or `?token=` because browsers cannot set headers on a WebSocket). OAuth2 access tokens cannot open a gateway connection.

A rejected handshake is an HTTP error with a JSON body: `401` `{"op": 8, "d": {"code": 401, "message": "invalid bot token"}}`. A bot, unlike a browser page, sends no `Origin` header, so the instance's allowed-origins list does not apply to it.

The first frame after a successful upgrade is `READY` (`op 4`).

## Frames

Every frame is a JSON object with an `op` and, usually, a `d`.

### Client → server

| `op` | Name | `d` | |
| --- | --- | --- | --- |
| `0` | Heartbeat | - | Optional; resets the read timeout. Answered by nothing |
| `1` | Subscribe | `{"space_id": "<space or room id>"}` | Start receiving a space's or a room's events. The server subscribes a connection itself as the account gains access, so this is for what it did not; see [Subscriptions](#subscriptions). A subscribe the account may not have is refused with `4403`. Subscriptions that need authorizing are rate limited per connection (a burst of 60, refilling ten a second; `4029` when exceeded); re-subscribing to a channel you already hold is free. A subscription ends when the membership that allowed it does: being kicked or banned, leaving, or losing View on a room drops it server-side. One account may hold 25 connections per gateway |
| `2` | Send | `{"space_id": "<room id>", "type": "typing", "content": {…}}` | Publish a lightweight event to a room's subscribers (typing). Messages are **not** sent this way - use REST |
| `5` | Unsubscribe | `{"space_id": "…"}` | Stop receiving a space's or a room's events |
| `6` | Ping | - | Answered with `op 7` |
| `9` | Activity | `{"activities": [{"type": "playing", "name": "…", "started_at": 1761000000000}]}` | Say what the account is doing on this connection; `null` or `[]` clears it. At most one entry, rate limited per connection (a burst of 5, then one every 12 s; over budget the latest report is applied when a token frees, without an error). See [Activity](#activity) |

### Server → client

| `op` | Name | `d` |
| --- | --- | --- |
| `3` | Event | `{"t": "MESSAGE_CREATE", "space_id": "…", "room_id": "…", "d": {…}}` - see [Event envelope](#event-envelope) and [Events](#events) |
| `4` | Ready | The [READY payload](#ready) |
| `7` | Pong | - |
| `8` | Error | `{"code": 4001, "message": "…"}` |

### Event envelope

An event frame nests: the outer `d` is the envelope, its `t` is the event type and its inner `d` the payload:

```json
{
  "op": 3,
  "d": {
    "t": "MESSAGE_CREATE",
    "space_id": "2102226824774811648",
    "room_id": "2102443061534523392",
    "d": { "id": "2105141774585434112", "room_id": "2102443061534523392", "space_id": "2102226824774811648", "sender_id": "…", "plaintext": "ping" }
  }
}
```

| Field | |
| --- | --- |
| `t` | The event type |
| `space_id` | The space the event belongs to. Absent for private message and group PM events, and for account events about no space (a friend request, a key backup) |
| `room_id` | The room the event is about: a text or voice room, a thread, a PM. Absent for space-wide events (roles, members, the space's settings) |
| `user_id` | Only on events delivered on the account's own channel, where it names that account - you, never whoever caused the event (the payload says who did) |
| `d` | The payload - see [Events](#events) |

Payloads carry the same ids, the way Discord's carry `channel_id` and `guild_id`: an object about a room has `room_id`, and `space_id` when the room is in a space; a space event has `space_id`. A missing id is absent, never `null`, so a room event without `space_id` is from a private message or group PM. The envelope's other fields (`origin`, `region`) are for the instance's own use.

> **Changed in November 2026.** The envelope's `space_id` used to repeat the room's id on room events, and `room_id` held the space's id on space-wide events. A bot that read `space_id` as the room should read `room_id` (or the payload's `room_id`, which was always right); `space_id` now only ever names a space. An instance in the middle of an upgrade can send the old form for a moment.

## READY

```json
{
  "op": 4,
  "d": {
    "user": { "id": "2105141069376131072", "username": "Docs_Bot", "display_name": "Docs Bot", "public_flags": 0, "bot": true },
    "session_id": "0",
    "rooms": [ { "id": "…", "type": 1, "recipients": ["…"], "e2ee_enabled": true, "created_at": "…" } ],
    "relationships": [],
    "spaces": [
      {
        "id": "2102226824774811648", "name": "Unread Test Space 2", "icon": "", "owner_id": "…",
        "everyone_role_id": "2102226824779005952",
        "roles": [ { "id": "…", "name": "@everyone", "permissions": 2334751, "position": 0, "color": 0, "hoist": false, "mentionable": false } ],
        "system_room_id": "…", "default_message_notifications": 0, "afk_timeout": 0
      }
    ],
    "space_rooms": {
      "2102226824774811648": [
        { "id": "2102443061534523392", "type": 3, "name": "files-test", "topic": "", "position": 3, "parent_id": "…", "e2ee_enabled": false, "slowmode_seconds": 0,
          "permission_overrides": [ { "role_id": "…", "allow": 0, "deny": 2 } ], "user_overrides": [] }
      ]
    },
    "voice_states": [],
    "calls": []
  }
}
```

| Field | |
| --- | --- |
| `user` | The connected account, with its own `presence` as only you see it: `invisible` stays `invisible`, and `activities` holds what any of your connections reports (see [Activity](#activity)) |
| `session_id` | The client session's id; `"0"` for a bot (a bot has no session row - its token is the credential) |
| `rooms` | Private messages and group PMs (room types `1` and `2`) with their `recipients` |
| `relationships` | Friends and friend requests; a friend's `user.presence` carries their `activities` |
| `spaces` | Every space the account is in, each with its `roles` (sorted by position) and settings |
| `space_rooms` | Space id → the rooms you can see in it (text `3`, voice `4`, section `5`, and active threads `6` with their `thread` block), each with `e2ee_enabled`, `slowmode_seconds` and its permission overrides. `SPACE_CREATE` carries a space's list in this same form |
| `voice_states`, `calls` | Who is in which voice room, and ringing PM calls |

Member lists are not in `READY` - fetch `GET /spaces/:id/members` when you need one and keep it current from the member events.

## Heartbeat

The server sends a WebSocket **ping** frame every 54 seconds and closes the connection if nothing (a pong, or any frame) arrives within 60 seconds. Every mainstream WebSocket library answers pings automatically, so a bot has nothing to do. Sending `{"op": 6}` yourself is fine and gets `{"op": 7}` back - useful as a liveness check through proxies.

There is no resume: after a disconnect, reconnect and read `READY` again. To recover messages missed while offline, page `GET /rooms/:id/messages` (newest first, `before=` to go back) until you reach the last id you saw.

## Subscriptions

Events are published on channels: one per **space** (space-wide events: roles, members, settings, rooms everyone in it can see), one per **room** (messages, reactions, typing, pins) and the account's **own channel**. An event's `space_id` and `room_id` say what it is about, not which channel brought it.

The server keeps a connection subscribed to what the account can see:

- **On connect**, a bot is subscribed to every space in `READY.spaces`, every room in `READY.space_rooms` (threads included) and every PM in `READY.rooms`. The Strafe client subscribes to what it shows itself, with `op 1`.
- **On gaining access**, every connection of the account, bot or not, is subscribed by the server as the event announcing it arrives - no `op 1`, and nothing published after that event is missed: the space and the rooms listed in `SPACE_CREATE` (a space joined, created, or a bot installed), the room in `ROOM_CREATE` (a PM or group PM opened, or being added to one) and in `SPACE_ROOM_CREATE` (a room created, or one you were let into), and the thread in `THREAD_CREATE` or on being added to or joining a thread (`THREAD_MEMBER_UPDATE` with `joined: true`). A room or thread announced to a whole space is subscribed on the connections that hold that space. What was sent before the event is history: page `GET /rooms/:id/messages` for it.
- The **own channel** (`user_id` events: relationship requests, new PMs, `SPACE_CREATE`, `SESSION_REVOKED`, read receipts) is always subscribed.

A subscription ends when the access that allowed it does - being kicked or banned, leaving, being removed from a group PM, or losing View on a room drops it server-side, without a frame of its own; `SPACE_LEAVE`, `ROOM_LEAVE` or `SPACE_ROOM_DELETE` on the account's own channel is how you hear.

`op 1` subscribes by hand, for a channel the server did not subscribe you to or one you dropped. The id goes in `space_id` for a space and for a room alike:

```json
{ "op": 1, "d": { "space_id": "2102226824774811648" } }   // the space itself
{ "op": 1, "d": { "space_id": "2102443061534523392" } }   // a room in it
```

A subscribe the account may not have - a room it cannot view, a space it is not in - is refused with error `4403`; the connection stays open. `op 5` with the same payload unsubscribes; a later event that grants the channel again (another `SPACE_ROOM_CREATE` for the room, say) subscribes it again.

## Sending over the gateway

`op 2` publishes a small event to a room's subscribers without going through REST. It is used for typing indicators:

```json
{ "op": 2, "d": { "space_id": "2102443061534523392", "type": "typing" } }
```

Subscribers receive it as a `MESSAGE` event whose `d` is the frame's `d`, with the room's `room_id` and `space_id` on the envelope. It is rate limited per connection (a burst of 20, refilling one every 250 ms) and requires the room subscription. Everything that is *stored* - messages, reactions, membership changes - goes through REST, and the gateway reports it back as an event.

## Activity

`op 9` sets what the account is doing - in this version, the game it is playing. The Strafe desktop app sends it when someone turns on sharing in its settings, and a bot can use it to show "Playing …" too:

```json
{ "op": 9, "d": { "activities": [ { "type": "playing", "name": "Factory Builder", "started_at": 1761000000000 } ] } }
{ "op": 9, "d": null }   // stopped playing
```

- **One entry at most.** `type` must be `"playing"`. `name` is cleaned before use - control characters, line and paragraph separators and bidi controls are removed, runs of whitespace become one space, the ends are trimmed - and must then hold 1 to 128 characters (counted in code points), at least one of them visible. `started_at` is unix milliseconds: `0` or absent means now, a time in the future becomes now, and one more than 7 days ago becomes 7 days ago.
- **A malformed report** (a second entry, another `type`, a name that is empty or too long) is answered with error `4007` and changes nothing. The connection stays open.
- **Rate limit:** a burst of 5 reports per connection, then one every 12 seconds. A report over the budget is not refused: it waits, a newer one replaces it, and the latest is applied when the next token frees, without an error frame. Reporting the same activity again changes nothing and costs nothing.
- **It belongs to the connection.** It is never written to the database: the instance holds it in its short-lived cache and forgets it when the connection closes (after a short grace period, so a quick reconnect does not flicker). A new connection starts with none, so report again after every `READY`. When several of an account's connections report, the most recent report wins.
- **Who sees it:** the account itself, its friends and the members of its spaces - in `PRESENCE_UPDATE`, on [member objects](/docs/rest/#the-member-object) and on friends' relationship entries, as `presence.activities`. Nobody else sees it while the account appears offline or invisible; its own connections still do. People on other instances see it the way they see the account's status.
- **Show the name as plain text** - never as Markdown, a link, emoji or a mention - and isolate its direction (`<bdi>`, `dir="auto"`), since it is someone else's text.

## Events

Room events reach every subscriber of the room; space events reach every subscriber of the space; account events reach only that account. Payloads are the objects described on the [REST](/docs/rest/) page unless noted. In the tables, `"space_id"?` is present when the room is in a space and absent in private messages and group PMs.

### Messages (room)

| `t` | `d` |
| --- | --- |
| `MESSAGE_CREATE` | The [message](/docs/rest/#the-message-object), plus `space_id` when the room is in a space. System notices (joins, leaves) have `sender_id: "0"` and a `system_type`. `embeds` is always there, an array (empty when the message has none) |
| `MESSAGE_UPDATE` | The edited message, with `space_id` likewise. It carries the message's whole `embeds` list as it now stands - an edit that removed them sends `[]` |
| `MESSAGE_DELETE` | `{"room_id", "space_id"?, "message_id"}` |
| `MESSAGE_REACTION_ADD` | `{"room_id", "space_id"?, "message_id", "user_id", "emoji"}` - `emoji` is a unicode string or `"custom:<id>"` |
| `MESSAGE_REACTION_REMOVE` | same |
| `ROOM_PINS_UPDATE` | `{"room_id", "space_id"?, "message_id", "user_id", "pinned", "pinned_at", "last_pin_timestamp"}` - a message was pinned (`pinned: true`, with `pinned_at`) or unpinned; `last_pin_timestamp` is when the room's newest remaining pin was made, `null` when none |
| `TYPING_START` | `{"room_id", "space_id"?, "user_id", "timestamp"}` (unix seconds) |

### Rooms

| `t` | Channel | `d` |
| --- | --- | --- |
| `SPACE_ROOM_CREATE` | space or account | The room, with `space_id` and its overrides. Handle it as an upsert: it can name a room you already have. Subscribes you to the room (see [Subscriptions](#subscriptions)) |
| `SPACE_ROOM_UPDATE` | space or account | The room (name, topic, slowmode, position, encryption, voice limits) |
| `SPACE_ROOM_DELETE` | space or account | `{"space_id", "room_id"}`. On your own channel it can also mean you lost sight of the room, not that it is gone |
| `SPACE_ROOM_OVERRIDE_UPDATE` / `_DELETE` | space | `{"space_id", "room_id", "role_id", "allow", "deny"}` |
| `SPACE_ROOM_USER_OVERRIDE_UPDATE` / `_DELETE` | space | `{"space_id", "room_id", "user_id", "allow", "deny"}` |
| `ROOM_CREATE` | account | A PM or group PM you are in was opened - by someone else, or by you on another connection - or you were added to one (ahead of the notice in the room that says so). The room. Subscribes you to it |
| `ROOM_UPDATE` | account | A PM's name or settings changed |
| `ROOM_LEAVE` | account | `{"room_id"}` - you were removed from a group PM |
| `MESSAGE_ACK` | account | `{"room_id", "space_id"?, "message_id", "last_read_message_id"}` - your own read position moved (another session read the room) |
| `MESSAGE_MENTION_UPDATE` | account | `{"room_id", "space_id"?, "mention_count", "message_id"?}` - your mention badge for a room, as an absolute count: after a message mentioned a role you hold (`message_id` is that message; ignore the count if you have already read past it), or after a message that mentioned you was deleted |
| `ROOM_NOTIFY_SETTINGS_UPDATE` | account | `{"room_id", "space_id"?, …}` - your notification setting for a room changed |

A room event goes to the space's channel only when nobody is kept out of the room; otherwise it goes to each member who can view it, on their own channel, with `space_id` in the payload.

Who can view a room can change without the room changing. When an override, the Section a room is synced to, or a member's roles change, when a role's View Room, Administrator or Manage Threads bit changes, or when a role is deleted, members who can view the affected rooms get `SPACE_ROOM_CREATE` and members who cannot get `SPACE_ROOM_DELETE`, which also ends their subscription to the room. A thread sent this way carries its `thread` block with the member's own `joined`; archived threads are not sent.

### Threads

Sent space-wide when everyone can view the parent channel, otherwise only to the members who can; a private thread's events go to its members alone. A thread is a room: its payloads carry `room_id` (the thread), `parent_id` and `space_id`.

| `t` | `d` |
| --- | --- |
| `THREAD_CREATE` | The thread room (type `6`, with its `thread` block, `parent_id` and `space_id`). A fresh thread's broadcast carries `newly_created: true` and the creator's `joined`; the same event goes to one person when they are added to a private thread, with their own `joined`. Subscribes you to the thread |
| `THREAD_UPDATE` | The thread room after a change (name, archive, lock, timer) |
| `THREAD_DELETE` | `{"space_id", "room_id", "parent_id"}` |
| `THREAD_MEMBERS_UPDATE` | `{"space_id", "room_id", "added_members": [{"user_id", "joined_at"}], "removed_member_ids", "member_count"}` |
| `THREAD_MEMBER_UPDATE` | To one user: `{"space_id", "room_id", "joined"}` - their own membership changed; `joined: true` subscribes them to the thread |

### Spaces and members

| `t` | Channel | `d` |
| --- | --- | --- |
| `SPACE_CREATE` | account | You created a space or were **added to one** (an invite redeemed elsewhere, a bot install, `spaces.join`). The space with its `roles`, `everyone_role_id` and `rooms`: every room you can see in it, active threads included, each as in [`READY.space_rooms`](#ready) - like Discord's `GUILD_CREATE` carrying its channels. Your connections are subscribed to the space and those rooms as it arrives. On a join it comes before the join notice (`MESSAGE_CREATE` in the system room) and your own `SPACE_MEMBER_ADD`, so both reach you |
| `SPACE_UPDATE` | space | The space's settings changed: the space, with `space_id`. May carry `roles` (the full list) after a change that reordered them, such as a bot install |
| `SPACE_DELETE` | space | `{"space_id"}` - the space is gone |
| `SPACE_LEAVE` | account | `{"space_id"}` - you were kicked, banned, or left from another session |
| `SPACE_MEMBER_ADD` | space | The member's profile plus `space_id`, `role_ids`, `joined_at`, `bot`, `presence` (with their `activities`), and their space profile: `nick`, `space_avatar`, `space_banner`, `space_about_me`, `space_bio`, `space_pronouns` (each a string, or `null` for none) |
| `SPACE_MEMBER_REMOVE` | space | `{"space_id", "user_id"}` |
| `SPACE_MEMBER_UPDATE` | space | `{"space_id", "user_id", "role_ids", "nick", "space_avatar", "space_banner", "space_about_me", "space_bio", "space_pronouns"}` - roles or the space profile changed; always the full state, so replace all seven fields |
| `SPACE_ROLE_CREATE` / `SPACE_ROLE_UPDATE` | space | The [role](/docs/rest/#the-role-object) |
| `SPACE_ROLE_DELETE` | space | `{"space_id", "role_id"}` |

### Account

| `t` | `d` |
| --- | --- |
| `PRESENCE_UPDATE` | `{"user_id", "presence": {"status": "online" \| "offline" \| …, "custom_status"?, "activities"?}}` for people you share a space or PM with. `activities` is what they are doing now (see [Activity](#activity)), for friends and space members only; absent means nothing, so replace the stored value rather than merging. Sent again when the status, the custom status or the activity changes. On a space's channel (the envelope's `space_id` names it) it is the view everyone gets, where `invisible` reads `offline` - your own presence included; your real status comes on your own channel, with no `space_id` |
| `USER_UPDATE` | A profile changed (display name, avatar, pronouns, …) - `{"user_id", "display_name", "avatar", "pronouns", …}` |
| `RELATIONSHIP_REQUEST` / `RELATIONSHIP_ADD` / `RELATIONSHIP_REMOVE` | Friend requests and friendships (people only) |
| `SESSION_REVOKED` | `{"reason"}` - this credential is dead: the account was banned from the instance, signed out everywhere, or (for a bot) the token was reset. The socket is closed right after |
| `VOICE_STATE_UPDATE` | A voice state, with `room_id` and, in a space, `space_id`; `left: true` when it ended, with `moved_to` (a room id) when a moderator moved them. In a space, sent to the space's channel only when nobody is kept out of the room, otherwise to the room's own channel (subscribe to it to hear a private room) and to the person it is about. `moved_to` names a room nobody else may see only to the person moved |
| `CALL_CREATE`, `CALL_UPDATE`, `CALL_DELETE` | A PM or group PM call started (ringing the others), its ringing list changed (`rerung: true` restarts the ringtone), or it ended |
| `TO_DEVICE`, `DEVICE_REVOKED`, `SESSION_ROTATE` | End-to-end encryption key traffic between devices. A bot can ignore these |
| `KEY_BACKUP_UPDATE` | `{"action": "created" \| "deleted", "version"}` - the account's [key backup](/docs/rest/#key-backup-session-only) version was created or deleted (for `deleted`, the version that went). A device pinned to a version that is no longer current stops uploading to it and asks the user to confirm the new one with the recovery code, without waiting for its next upload to fail |

## Errors

Errors after the handshake arrive as `{"op": 8, "d": {"code", "message"}}` and never close the connection.

| Code | Meaning |
| --- | --- |
| `401` (handshake) | Missing, malformed or unknown credential |
| `4000` | The frame was not valid JSON |
| `4001` | Unknown `op` |
| `4002` | Invalid subscribe payload |
| `4003` | Invalid send payload |
| `4004` | `op 2` without a `space_id` |
| `4005` | `op 2` to a channel you have not subscribed to |
| `4007` | Invalid activity (`op 9`): more than one entry, a `type` other than `playing`, or a name that is empty or longer than 128 characters once cleaned - see [Activity](#activity) |
| `4403` | A subscribe (`op 1`) to a space or room you cannot access. Nothing else changes; the connection stays open |

An `op 2` frame that exceeds the send bucket is dropped without an error. An `op 9` report over its budget is not dropped: the latest one is applied when the next token frees, also without an error.
