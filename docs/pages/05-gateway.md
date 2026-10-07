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
| `1` | Subscribe | `{"space_id": "<space or room id>"}` | Start receiving a space's or a room's events. Bots are subscribed to everything on connect; see [Subscriptions](#subscriptions) |
| `2` | Send | `{"space_id": "<room id>", "type": "typing", "content": {…}}` | Publish a lightweight event to a room's subscribers (typing). Messages are **not** sent this way - use REST |
| `5` | Unsubscribe | `{"space_id": "…"}` | Stop receiving a space's or a room's events |
| `6` | Ping | - | Answered with `op 7` |

### Server → client

| `op` | Name | `d` |
| --- | --- | --- |
| `3` | Event | `{"t": "MESSAGE_CREATE", "room_id": "…", "space_id": "…", "user_id": "…", "d": {…}}` - see [Events](#events) |
| `4` | Ready | The [READY payload](#ready) |
| `7` | Pong | - |
| `8` | Error | `{"code": 4001, "message": "…"}` |

An event frame nests: the outer `d` is the envelope, its `t` is the event type and its inner `d` the payload:

```json
{
  "op": 3,
  "d": {
    "t": "MESSAGE_CREATE",
    "space_id": "2102443061534523392",
    "room_id": "2102443061534523392",
    "d": { "id": "2105141774585434112", "room_id": "2102443061534523392", "sender_id": "…", "plaintext": "ping" }
  }
}
```

`room_id` is set for room events (the field `space_id` repeats it - a historical quirk), `user_id` for events delivered on the account's own channel.

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
| `user` | The connected account |
| `session_id` | The client session's id; `"0"` for a bot (a bot has no session row - its token is the credential) |
| `rooms` | Private messages and group PMs (room types `1` and `2`) with their `recipients` |
| `spaces` | Every space the account is in, each with its `roles` (sorted by position) and settings |
| `space_rooms` | Space id → its rooms (text `3`, voice `4`, section `5`), each with `e2ee_enabled`, `slowmode_seconds` and its permission overrides |
| `voice_states`, `calls` | Who is in which voice room, and ringing PM calls |

Member lists are not in `READY` - fetch `GET /spaces/:id/members` when you need one and keep it current from the member events.

## Heartbeat

The server sends a WebSocket **ping** frame every 54 seconds and closes the connection if nothing (a pong, or any frame) arrives within 60 seconds. Every mainstream WebSocket library answers pings automatically, so a bot has nothing to do. Sending `{"op": 6}` yourself is fine and gets `{"op": 7}` back - useful as a liveness check through proxies.

There is no resume: after a disconnect, reconnect and read `READY` again. To recover messages missed while offline, page `GET /rooms/:id/messages` (newest first, `before=` to go back) until you reach the last id you saw.

## Subscriptions

Events are published on channels, one per **space** (space-wide events: roles, members, settings) and one per **room** (messages, reactions, typing). Both are subscribed with `op 1` and the id in `space_id`:

```json
{ "op": 1, "d": { "space_id": "2102226824774811648" } }   // the space itself
{ "op": 1, "d": { "space_id": "2102443061534523392" } }   // a room in it
```

A subscription is refused (silently) when the account cannot access that room or is not in that space.

- **Bots are auto-subscribed** on connect to every space in `READY.spaces`, every room in `READY.space_rooms`, and every PM in `READY.rooms`. A bot only subscribes by hand to a space it joins *after* connecting (announced by `SPACE_CREATE`) and that space's rooms, or a room created while it is connected (`SPACE_ROOM_CREATE`).
- The account's **own channel** (`user_id` events: relationship requests, new PMs, `SPACE_CREATE`, `SESSION_REVOKED`, read receipts) is always subscribed.
- Clients manage their subscriptions themselves and use `op 5` when they leave a space.

## Sending over the gateway

`op 2` publishes a small event to a room's subscribers without going through REST. It is used for typing indicators:

```json
{ "op": 2, "d": { "space_id": "2102443061534523392", "type": "typing" } }
```

It is rate limited per connection (a burst of 20, refilling one every 250 ms) and requires the room subscription. Everything that is *stored* - messages, reactions, membership changes - goes through REST, and the gateway reports it back as an event.

## Events

Room events reach every subscriber of the room; space events reach every subscriber of the space; account events reach only that account. Payloads are the objects described on the [REST](/docs/rest/) page unless noted.

### Messages (room)

| `t` | `d` |
| --- | --- |
| `MESSAGE_CREATE` | The [message](/docs/rest/#the-message-object). System notices (joins, leaves) have `sender_id: "0"` and a `system_type` |
| `MESSAGE_UPDATE` | The edited message |
| `MESSAGE_DELETE` | `{"room_id", "message_id"}` |
| `MESSAGE_REACTION_ADD` | `{"room_id", "message_id", "user_id", "emoji"}` - `emoji` is a unicode string or `"custom:<id>"` |
| `MESSAGE_REACTION_REMOVE` | same |
| `ROOM_PINS_UPDATE` | `{"room_id", "message_id", "user_id", "pinned", "pinned_at", "last_pin_timestamp"}` - a message was pinned (`pinned: true`, with `pinned_at`) or unpinned; `last_pin_timestamp` is when the room's newest remaining pin was made, `null` when none |
| `TYPING_START` | `{"room_id", "user_id", "timestamp"}` (unix seconds) |

### Rooms

| `t` | Channel | `d` |
| --- | --- | --- |
| `SPACE_ROOM_CREATE` | space | The new room, with overrides |
| `SPACE_ROOM_UPDATE` | space | The room (name, topic, slowmode, position, encryption, voice limits) |
| `SPACE_ROOM_DELETE` | space | `{"space_id", "room_id"}` |
| `SPACE_ROOM_OVERRIDE_UPDATE` / `_DELETE` | space | `{"space_id", "room_id", "role_id", "allow", "deny"}` |
| `SPACE_ROOM_USER_OVERRIDE_UPDATE` / `_DELETE` | space | `{"space_id", "room_id", "user_id", "allow", "deny"}` |
| `ROOM_CREATE` | account | A PM or group PM was opened with you |
| `ROOM_UPDATE` | room | A PM's name or settings changed |
| `ROOM_LEAVE` | account | You were removed from a group PM |
| `MESSAGE_ACK` | account | `{"room_id", "message_id", "last_read_message_id"}` - your own read position moved (another session read the room) |
| `ROOM_NOTIFY_SETTINGS_UPDATE` | account | Your notification setting for a room changed |

### Spaces and members

| `t` | Channel | `d` |
| --- | --- | --- |
| `SPACE_CREATE` | account | You created a space or were **added to one** (an invite redeemed elsewhere, a bot install, `spaces.join`). The space with its `roles`; rooms are not included |
| `SPACE_UPDATE` | space | The space's settings changed. May carry `roles` (the full list) after a change that reordered them, such as a bot install |
| `SPACE_DELETE` | space | `{"space_id"}` - the space is gone |
| `SPACE_LEAVE` | account | `{"space_id"}` - you were kicked, banned, or left from another session |
| `SPACE_MEMBER_ADD` | space | The member's profile plus `space_id`, `role_ids`, `bot`, `presence` |
| `SPACE_MEMBER_REMOVE` | space | `{"space_id", "user_id"}` |
| `SPACE_MEMBER_UPDATE` | space | `{"user_id", "role_ids"}` - roles changed |
| `SPACE_ROLE_CREATE` / `SPACE_ROLE_UPDATE` | space | The [role](/docs/rest/#the-role-object) |
| `SPACE_ROLE_DELETE` | space | `{"role_id"}` |

### Account

| `t` | `d` |
| --- | --- |
| `PRESENCE_UPDATE` | `{"user_id", "presence": {"status": "online" \| "offline" \| …}}` for people you share a space or PM with |
| `USER_UPDATE` | A profile changed (display name, avatar, pronouns, …) - `{"user_id", "display_name", "avatar", "pronouns", …}` |
| `RELATIONSHIP_REQUEST` / `RELATIONSHIP_ADD` / `RELATIONSHIP_REMOVE` | Friend requests and friendships (people only) |
| `SESSION_REVOKED` | `{"reason"}` - this credential is dead: the account was banned from the instance, signed out everywhere, or (for a bot) the token was reset. The socket is closed right after |
| `VOICE_STATE_UPDATE`, `CALL_RING`, `CALL_DECLINE`, `CALL_END` | Voice and video (see the client) |
| `TO_DEVICE`, `DEVICE_REVOKED`, `SESSION_ROTATE` | End-to-end encryption key traffic between devices. A bot can ignore these |

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
| `4403` | A subscribe to a space or room you cannot access |

An `op 2` frame that exceeds the send bucket is dropped without an error.
