---
title: Getting started
description: What you can build on Strafe, the URLs of this instance, how requests are authenticated, and the conventions every endpoint follows.
slug: index
---

# Strafe Developer Documentation

Build bots that live in spaces, and applications that let people **sign in with Strafe**. Both go through the same two doors: a REST API and a real-time WebSocket gateway. Everything on this site describes the instance you are reading it on - the addresses in the sidebar are this instance's own.

> [!NOTE]
> Strafe is federated and self-hosted. There is no central "Strafe API": each instance has its own API, its own gateway and its own applications. A bot lives on the instance where its application was created, and the URLs below are for **this** instance.

## What you can build

| You want to… | Use | Start with |
| --- | --- | --- |
| Run a bot that reads and posts messages in spaces | A **bot** - an application's bot account, authenticated with a bot token | [Bots](/docs/bots/) |
| Let people log in to your site or app with their Strafe account | **OAuth2** - the authorization code grant with the `identify` / `email` / `spaces` scopes | [OAuth2](/docs/oauth2/) |
| Let a bot add people to a space from your own website | OAuth2 with the `spaces.join` scope, plus a bot with Create Invite | [OAuth2 › spaces.join](/docs/oauth2/#spaces-join-adding-users-to-a-space) |
| Let anyone add your bot to their space with a link | An install link with the `bot` scope and a permissions value | [Applications › Install links](/docs/applications/#install-links) |

## Quick start

1. Open **Settings → Developers** in the Strafe client and create an application. You get a **client ID** and a **client secret** (shown once).
2. **Add a bot** to the application. You get a **bot token** (shown once). The bot's user ID is the same as the application's client ID.
3. Add the bot to a space you manage with the **Add to a space** button, or share the link the **URL generator** builds.
4. Talk to the API with `Authorization: Bot <token>`, and connect to the gateway with the same header to receive messages as they happen.

```bash
# Who am I?
curl -H "Authorization: Bot $BOT_TOKEN" <API>/users/@me

# Say hello in a room
curl -X POST -H "Authorization: Bot $BOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"plaintext":"Hello from my bot!"}' \
  <API>/rooms/ROOM_ID/messages
```

Replace `<API>` with this instance's API base: <code data-instance="api">https://your-instance.example/api</code>.

## This instance

| | URL |
| --- | --- |
| Web client (and the OAuth2 consent page at `/oauth2/authorize`) | <code data-instance="web">https://your-instance.example</code> |
| REST API base | <code data-instance="api">https://your-instance.example/api</code> |
| Gateway (WebSocket) | <code data-instance="gateway">wss://your-instance.example/gateway/events</code> |
| CDN (avatars, icons, attachments, emoji) | <code data-instance="cdn">https://your-instance.example/cdn</code> |

On a standard deployment the API is served under `/api` and the gateway under `/gateway` of the instance's domain. Paths in this documentation are relative to the API base: `GET /users/@me` means `GET <API>/users/@me`.

## Authentication

Every request carries one credential in the `Authorization` header. Nothing is read from cookies or query strings.

| Header | Who | Gets |
| --- | --- | --- |
| `Authorization: Bot <bot token>` | A bot | Everything the bot account may do - the same endpoints a person's client uses, gated by the bot's permissions in each space |
| `Authorization: Bearer <access token>` | An application acting for a user who authorized it | Only the endpoints its **scopes** allow (see [OAuth2 › Scopes](/docs/oauth2/#scopes)); anything else is `403 insufficient_scope` |
| `Authorization: Bearer <session token>` | The Strafe client itself | A person's full account. Not for applications: never ask a user for their session token |

The gateway accepts the same `Bot` header on the WebSocket handshake.

> [!WARNING]
> A bot token is a password. Keep it out of source control, client-side code and screenshots. If it leaks, **Reset token** in Settings → Developers invalidates it immediately and disconnects the bot's gateway sessions.

## Conventions

- **IDs are strings.** Every id (`"2105141069376131072"`) is a 64-bit snowflake sent as a JSON string, because JavaScript numbers cannot hold it. Send ids back as strings too.
- **Timestamps** are RFC 3339 / ISO 8601 in UTC: `"2026-09-30T03:44:45.361Z"`.
- **Permissions** are integer bitmasks (see [Permissions](/docs/permissions/)). They fit comfortably in a JavaScript number.
- **JSON in, JSON out.** Send `Content-Type: application/json`. The one exception is the OAuth2 token endpoint, which also takes a form body as the standard requires, and file uploads, which are `multipart/form-data`.
- **Errors** are `{"error": "message"}` with a matching HTTP status (`400` bad input, `401` bad or missing credentials, `403` not allowed, `404` not found, `409` conflict, `429` slow down). OAuth2 endpoints use the RFC 6749 error codes (`invalid_grant`, `invalid_scope`, …) and may add an `error_description`.
- **Rate limits** are per endpoint group and return `429` with a `Retry-After` header when exceeded. Slowmode in a room returns `429` with `retry_after` seconds in the body. See [REST › Rate limits](/docs/rest/#rate-limits).
- **End-to-end encryption.** Private messages are end-to-end encrypted by default and space rooms can opt in. A bot cannot read or write in an encrypted room - messages there arrive with `ciphertext` and no `plaintext`. See [Bots › Encryption](/docs/bots/#encryption-and-what-a-bot-can-see).

## Vocabulary

Strafe borrows Discord's interaction model with its own names. If you have written a Discord bot, this table is the translation:

| Strafe | Discord | Notes |
| --- | --- | --- |
| **Space** | Server / guild | `spaces` in every path and payload |
| **Room** | Channel | Space text and voice rooms, and private messages, are all rooms |
| **Section** | Category | A room of type `5` that groups other rooms |
| **PM** / group PM | DM / group DM | Rooms of type `1` and `2`; end-to-end encrypted by default |
| Member, role, invite, emoji, reaction | same | |
