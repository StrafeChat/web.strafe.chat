---
title: Push notifications
description: How a client registers a device for push notifications, the encrypted Web Push the instance sends, and the payload inside it - for anyone building a client of their own.
---

# Push notifications

An instance notifies a signed-in device about new messages, mentions and incoming calls while the app is closed, and tells it when a conversation was read elsewhere so it can clear what it showed. It does this with standard **Web Push**: [RFC 8030](https://www.rfc-editor.org/rfc/rfc8030) delivery, [RFC 8291](https://www.rfc-editor.org/rfc/rfc8291) message encryption and [RFC 8292](https://www.rfc-editor.org/rfc/rfc8292) VAPID, to whatever endpoint the device registered. Any Web Push endpoint works: your app's push gateway (which relays to FCM or APNs), a UnifiedPush distributor, or a browser's push service.

Every push body is encrypted to a key only the device holds, so nothing in between - the gateway, Apple, Google, a UnifiedPush server - can read it. In an end-to-end encrypted room the instance has no plaintext either: the push says who wrote where, never what.

These endpoints are **session only**: they act on the subscription of the session making the request. A bot token or an OAuth2 token is refused (`403`), and so a third-party application can never register pushes for a user.

## Registering a device

1. Generate a P-256 key pair and a 16-byte random auth secret on the device, and keep the private half there.
2. Get an endpoint: from your push gateway (`POST /v1/register` on a Strafe push gateway), from a UnifiedPush distributor, or from `PushManager.subscribe()` in a browser (with the key from `GET /push/vapid-key` as `applicationServerKey`).
3. `PUT /users/@me/push` with the endpoint, the public key and the auth secret.
4. Re-`PUT` whenever the endpoint, the keys or the preferences change; `DELETE` before signing out. Signing out, or the session being revoked any other way, deletes the subscription on the server too.

### `GET` /push/vapid-key — *no auth*

The instance's VAPID public key (base64url, 65-byte uncompressed P-256 point). Every push the instance sends is signed with the matching private key.

```json
{ "public_key": "BIRTmQr1kq4FmZEoNL3JCMBubhO26I0zrxWumhfzHij5RbmeXnzGOXfMlGeINaPRBncuLUGsNOFhIoj73jwH7cQ" }
```

### `PUT` /users/@me/push

Subscribe this session, replacing any earlier subscription of the same session.

```json
{
  "endpoint": "https://push.strafe.chat/v1/push/AbC…",
  "keys": { "p256dh": "<base64url, 65-byte uncompressed P-256 point>", "auth": "<base64url, 16 bytes>" },
  "kind": "fcm",
  "prefs": { "preview": true, "pm": "all", "space": "mentions", "calls": true }
}
```

| Field | |
| --- | --- |
| `endpoint` | Absolute `https://` URL, at most 2048 characters, on a public address. An instance may restrict push hosts; a refused host is a `400` with the reason. |
| `keys.p256dh` | The device's public key; must be a point on P-256 |
| `keys.auth` | The device's auth secret |
| `kind` | `fcm`, `apns`, `unifiedpush` or `web` - which transport the endpoint leads to (shown back to the user; the instance sends the same Web Push to all) |
| `prefs.preview` | Include a text preview of messages from rooms that are not end-to-end encrypted. Default `true` |
| `prefs.pm` | `all` or `none` - PMs and group PMs. Default `all` |
| `prefs.space` | `all`, `mentions` or `none` - rooms in spaces. Default `mentions` |
| `prefs.calls` | Ring for incoming calls. Default `true` |

A room's own notification setting (all / mentions / nothing, mute) overrides `pm` and `space`, as it does in the client. Missing preferences take the defaults. Returns `200 {"subscription": <subscription>}`; limited to 10 per minute.

### The subscription object

What `PUT`, `PATCH` and `GET` return. It never contains the keys or the full endpoint.

```json
{
  "kind": "fcm", "endpoint_host": "push.strafe.chat",
  "prefs": { "preview": true, "pm": "all", "space": "mentions", "calls": true },
  "created_at": "…", "updated_at": "…",
  "last_success_at": "…", "last_error": "", "failures": 0
}
```

`last_error` and `failures` describe recent deliveries: `http 403`, `timeout`, `network error` and so on. A subscription whose push service answers `404`/`410` is deleted, and so is one refused five times in a row.

### `PATCH` /users/@me/push

`{"prefs": {...}}` with any subset of the preferences. `200 {"subscription": …}`, or `404` without a subscription.

### `GET` /users/@me/push

`200 {"subscription": …}`, or `404`.

### `DELETE` /users/@me/push

`204`, whether or not there was a subscription.

### `POST` /users/@me/push/test

Sends a `test` push to this session's subscription right away and reports what the push service answered: `{"delivered": true}` or `{"delivered": false, "status": 403, "error": "http 403"}` (`status` is `0` for a network error). `404` without a subscription; limited to 5 per minute.

## What arrives

`POST <endpoint>` with `Content-Encoding: aes128gcm`, `TTL`, `Urgency`, sometimes `Topic`, and `Authorization: vapid t=<JWT>, k=<VAPID public key>`. The body is a single aes128gcm record (record size 4096) whose key id is the instance's one-off public key for that push. Decrypt it as RFC 8291 describes, then strip the padding: the plaintext ends with a `0x02` byte followed by zeros, and is always padded to 256, 512, 1024 or 2048 bytes.

| `t` | When | `Urgency` | `TTL` | `Topic` |
| --- | --- | --- | --- | --- |
| `msg` | A message the user wants to hear about | `high` | 86400 | - |
| `call` | An incoming call started ringing (or rang again) | `high` | 45 | `c<room id>` |
| `call_end` | It stopped ringing: answered, declined, ended | `normal` | 60 | `c<room id>` |
| `read` | The room was read on another device | `low` | 3600 | `r<room id>` |
| `test` | `POST /users/@me/push/test` | `high` | 300 | - |

### The payload

Compact JSON, at most 2047 bytes, ids as strings. Ignore fields you do not know; ignore a payload whose `v` or `t` you do not know, and one whose `uid` is not the account you registered for.

```json
{
  "v": 1, "t": "msg", "uid": "123", "ts": 1760000000000,
  "rid": "456", "rt": 3, "sid": "789", "mid": "1011",
  "a": { "id": "1213", "n": "Alice", "av": "https://cdn.example/v1/avatars/1213/abc.webp" },
  "rn": "general", "sn": "Strafe HQ",
  "b": "hey @Bob look at this", "att": 2, "m": true
}
```

| Field | |
| --- | --- |
| `v` | Payload version, `1` |
| `t` | `msg`, `read`, `call`, `call_end`, `test` |
| `uid` | The account it is for |
| `ts` | When it happened (Unix milliseconds) |
| `rid`, `rt` | The room and its type: `1` PM, `2` group PM, `3` space text, `4` space voice, `6` thread |
| `sid` | The space (space rooms and threads only) |
| `mid` | `msg`: the message. `read`: read up to and including this message |
| `a` | `msg`: the author; `call`: the caller - `id`, `n` (display name, else username), `av` (avatar URL, when there is one). In a space room or thread, `n` is the author's nickname in that space and `av` their space avatar, whenever they have set one; PMs, group PMs and calls always carry the global profile |
| `rn` | Room name: a channel's or thread's name, a group PM's name or its first few members; absent for a 1:1 PM |
| `pn` | A thread's channel name |
| `sn` | The space's name |
| `e` | The room is end-to-end encrypted; there is never a `b` |
| `b` | Plain-text preview (at most 300 characters; mentions written out as `@name`, using the member's nickname in a space room or thread when they have one and the global name in PMs; custom emoji as `:name:`), only for a room that is not end-to-end encrypted and a subscription with `preview` on. Absent when the message is only attachments |
| `att` | Number of attachments |
| `m` | The message mentions the recipient - directly, through a role, or with `@everyone`/`@here` |
| `vid` | `call`: reserved for video calls |

`read` carries `rid`, `rt`, `sid` and `mid`; `call` carries `rid`, `rt`, `a` and, for a group, `rn`; `call_end` only `rid` and `rt`; `test` nothing beyond the first four fields.

### Who gets one

The instance decides as the client does when it is open: never for your own message, nothing from someone you blocked, nothing from a room you cannot see or have muted, nothing while your status is Do Not Disturb; otherwise the room's own setting, then `prefs.space` (narrowed to mentions when the space defaults to only mentions) or `prefs.pm`. Calls ring through Do Not Disturb, unless `prefs.calls` is off. A `read` is sent only if a `msg` push for that room was delivered since it was last read.
