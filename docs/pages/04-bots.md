---
title: Bots
description: From a bot token to a running bot - connecting to the gateway, answering messages, mentions, replies, reactions, attachments, encryption, and complete Node.js and Python examples.
---

# Bots

A bot is an application's bot account: a member of the spaces it was added to, driven by a program instead of a person. It talks to the same API and gateway the Strafe client does, with `Authorization: Bot <token>`.

The shape of every bot is the same:

1. **Connect** to the gateway with the bot token. The first frame is `READY`: the bot's user, every space it is in with their roles, every room in those spaces, and its private messages.
2. **Listen** for events - `MESSAGE_CREATE` when someone posts, `SPACE_CREATE` when the bot is added somewhere new, and so on. A bot is subscribed to everything it can see from the start; there is no subscription bookkeeping.
3. **Act** through REST: post a message, add a reaction, kick a member, create an invite.

## Before you start

- Create an application and add a bot in **Settings → Developers** ([Applications](/docs/applications/)). Keep the token.
- Add the bot to a space you manage with **Add to a space**, or open an [install link](/docs/applications/#install-links).
- Pick a room whose encryption is **off**. Space text rooms are plain by default; a room with a lock icon in the client is end-to-end encrypted and a bot cannot read it (see [Encryption](#encryption-and-what-a-bot-can-see)).

This instance: API <code data-instance="api">https://your-instance.example/api</code>, gateway <code data-instance="gateway">wss://your-instance.example/gateway/events</code>.

## A complete bot in Node.js

Replies "pong" to anyone who says `!ping`. Needs Node 18+ and the `ws` package (`npm install ws`).

```js
import WebSocket from 'ws';

const TOKEN = process.env.BOT_TOKEN;
const API = process.env.STRAFE_API;         // e.g. https://chat.example.org/api
const GATEWAY = process.env.STRAFE_GATEWAY; // e.g. wss://chat.example.org/gateway/events

const headers = { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' };

async function send(roomId, body) {
  const res = await fetch(`${API}/rooms/${roomId}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`send failed: ${res.status} ${await res.text()}`);
  return res.json();
}

let me = null;

function connect() {
  const ws = new WebSocket(GATEWAY, { headers: { Authorization: `Bot ${TOKEN}` } });

  ws.on('message', async (raw) => {
    const frame = JSON.parse(raw);
    if (frame.op === 4) {                       // READY
      me = frame.d.user;
      console.log(`online as ${me.username}, in ${frame.d.spaces?.length ?? 0} spaces`);
      return;
    }
    if (frame.op !== 3) return;                 // EVENT
    const { t, d } = frame.d;
    if (t === 'MESSAGE_CREATE' && d.plaintext === '!ping' && d.sender_id !== me.id) {
      await send(d.room_id, { plaintext: `pong, <@${d.sender_id}>!`, reply_to_id: d.id });
    }
    if (t === 'SESSION_REVOKED') console.log('token reset - stopping');
  });

  ws.on('close', (code) => {
    console.log(`gateway closed (${code}); reconnecting in 5s`);
    setTimeout(connect, 5000);
  });
  ws.on('error', (err) => console.error('gateway error', err.message));
}

connect();
```

The same bot in Python (`pip install websockets requests`):

```python
import asyncio, json, os, requests, websockets

TOKEN = os.environ["BOT_TOKEN"]
API = os.environ["STRAFE_API"]
GATEWAY = os.environ["STRAFE_GATEWAY"]
HEADERS = {"Authorization": f"Bot {TOKEN}"}

def send(room_id, plaintext, reply_to=None):
    body = {"plaintext": plaintext}
    if reply_to:
        body["reply_to_id"] = reply_to
    r = requests.post(f"{API}/rooms/{room_id}/messages", json=body, headers=HEADERS, timeout=10)
    r.raise_for_status()
    return r.json()

async def main():
    while True:
        try:
            async with websockets.connect(GATEWAY, additional_headers=HEADERS) as ws:
                me = None
                async for raw in ws:
                    frame = json.loads(raw)
                    if frame["op"] == 4:
                        me = frame["d"]["user"]
                        print("online as", me["username"])
                    elif frame["op"] == 3:
                        t, d = frame["d"]["t"], frame["d"]["d"]
                        if t == "MESSAGE_CREATE" and d.get("plaintext") == "!ping" and d["sender_id"] != me["id"]:
                            send(d["room_id"], f"pong, <@{d['sender_id']}>!", reply_to=d["id"])
        except Exception as e:
            print("gateway error:", e, "- reconnecting in 5s")
            await asyncio.sleep(5)

asyncio.run(main())
```

Both examples do the three things every bot must: authenticate with the `Bot` header (on the WebSocket handshake **and** on REST calls), ignore their own messages, and reconnect when the socket drops.

## Receiving messages

`MESSAGE_CREATE` carries the full message ([shape](/docs/rest/#the-message-object)). The fields a bot usually looks at:

| Field | |
| --- | --- |
| `room_id` | Where it was posted - use it to reply |
| `sender_id` | Who posted it. `"0"` for system notices (joins, leaves), which also carry `system_type` |
| `plaintext` | The text, when the room is not encrypted. Absent in encrypted rooms |
| `mentions`, `mention_roles`, `mention_everyone` | Who the message pings (user ids, role ids) |
| `reply_to_id` | The message it replies to, if any |
| `attachments` | Uploaded files, each with `id`, `filename`, `url`, `content_type`, `size` and image dimensions |

`MESSAGE_UPDATE` carries the edited message and `MESSAGE_DELETE` just `{room_id, message_id}`. Reactions arrive as `MESSAGE_REACTION_ADD` / `MESSAGE_REACTION_REMOVE` with `{room_id, message_id, user_id, emoji}`.

To know *which space* a room belongs to, look the room up in the `space_rooms` map from `READY` (or `GET /rooms/:id`, whose `space_id` names the space; private messages have none).

## Sending messages

`POST /rooms/:id/messages` with a JSON body. The bot needs **View Room** and **Send Messages** in that room (see [Permissions](/docs/permissions/)).

```json
{
  "plaintext": "Deploy finished ✅ <@2102223172425220096> take a look at <#2102443061534523392>",
  "reply_to_id": "2105141774585434112",
  "mentions": ["2102223172425220096"],
  "attachments": ["2105150001234567890"]
}
```

| Field | |
| --- | --- |
| `plaintext` | The text. Markdown as the client renders it (bold, italic, code, links). Required unless attachments are sent |
| `reply_to_id` | Reply to a message in the same room |
| `mentions` | User ids to notify. Mentions in the text (`<@id>`) are detected automatically; this list adds to them |
| `mention_roles` | Role ids to notify; role mentions (`<@&id>`) in the text are detected too. Only mentionable roles ping |
| `mention_everyone` | `true` to ping everyone - needs the **Mention @everyone** permission, otherwise it is silently ignored |
| `attachments` | Ids returned by the upload endpoint (below), at most a handful per message |

The response is the created message (`201`). In a room with **slowmode**, sending too soon returns `429` with `{"error": "slowmode is on in this channel", "retry_after": 12}`.

### Formatting

| Write | Renders as |
| --- | --- |
| `<@2102223172425220096>` | A user mention (pings them) |
| `<@&2102226824779005952>` | A role mention (pings the role if it is mentionable) |
| `<#2102443061534523392>` | A room link |
| `<:blobby:2102443078081052672>` | A custom emoji of a space the message is posted in |
| `<a:party:…>` | An animated custom emoji |
| `**bold**`, `*italic*`, `` `code` ``, ```` ``` ```` fences, `> quote`, `[text](https://…)` | Markdown |

### Attachments

Upload first, then reference the id in the message:

```bash
curl -X POST <API>/rooms/ROOM_ID/attachments \
  -H "Authorization: Bot $BOT_TOKEN" \
  -F "file=@chart.png" -F "width=1280" -F "height=720"
```

The response is the attachment record; put its `id` in the message's `attachments`. An uploaded file must be used by a message from the same bot in the same room. `width`/`height` are optional hints for images so clients can reserve space before the image loads. Uploads are only possible when the instance has its object store configured (it is on a standard deployment).

### Editing and deleting

`PATCH /rooms/:id/messages/:msg_id` with `{"plaintext": "…"}` edits one of the bot's own messages. `DELETE /rooms/:id/messages/:msg_id` deletes it; with **Manage Messages** the bot can delete anyone's.

### Reactions and typing

- `PUT /rooms/:id/messages/:msg_id/reactions/:emoji` adds the bot's reaction; `DELETE` removes it. `:emoji` is a URL-encoded unicode emoji (`%F0%9F%91%8B` for 👋) or `custom:<emoji id>`.
- `GET /rooms/:id/messages/:msg_id/reactions/:emoji` lists who reacted.
- `POST /rooms/:id/typing` shows the bot as typing for a few seconds (at most one indicator per 5 seconds is broadcast).

## Being added to a space

When someone installs the bot, the connected bot receives `SPACE_CREATE` on its own channel with the space (and its roles). Rooms are not included and events for the new space are not yet flowing, so:

1. `GET /spaces/:id/rooms` to learn the rooms.
2. Subscribe: send `{"op": 1, "d": {"space_id": "<space id>"}}` for space-wide events and one `{"op": 1, "d": {"space_id": "<room id>"}}` per room for messages. (Yes, the field is `space_id` for both - see [Gateway › Subscriptions](/docs/gateway/#subscriptions).)

Or simply reconnect: everything is subscribed automatically on `READY`.

`SPACE_LEAVE` (kicked, banned, or the space was deleted → `SPACE_DELETE`) means the bot is out. Its managed role is removed with it.

## Permissions

The bot's permissions are its roles' permissions, resolved per room exactly as for a person: the space-wide mask, then the room's overrides. Every permission it might need must be granted by whoever installs it (the `permissions` value in the install link) or by a space admin afterwards, in the roles editor. A bot can never be handed more than the installer holds.

What a bot usually asks for:

| Bot does | Needs |
| --- | --- |
| Read and post | View Room, Send Messages, Read Message History (`1 + 2 + 4 = 7`) |
| React | Add Reactions (`8`), Use External Emojis (`16`) |
| Moderate | Manage Messages (`64`), Kick Members (`512`), Ban Members (`1024`) |
| Make invites | Create Invite (`8192`) |
| Manage rooms and roles | Manage Rooms (`256`), Manage Roles (`128`) |

Add the values together for the `permissions` parameter. The full table, and how overrides and hierarchy apply, is on the [Permissions](/docs/permissions/) page.

## Encryption and what a bot can see

Strafe is end-to-end encrypted where it matters: **private messages are E2EE by default**, and any space text room can be switched to E2EE by its admins. Encryption is done by the members' devices; the server - and therefore a bot - only ever sees ciphertext there.

- In an encrypted room, `MESSAGE_CREATE` arrives with `ciphertext` and no `plaintext`, and `POST /rooms/:id/messages` requires `ciphertext` (which a bot has no keys to produce). Practically: **bots work in plain rooms only.**
- `GET /rooms/:id` and every room in `READY` carry `e2ee_enabled`. Check it before posting.
- A person can message a bot privately only by turning encryption off for that PM.

This is by design, not a gap to work around: a room that promises end-to-end encryption must not have a server-side reader in it.

## Presence and rate limits

- A bot shows as **online** while it holds at least one gateway connection and goes offline shortly after the last one closes.
- The gateway allows a burst of 20 client frames and refills one every 250 ms; REST endpoints have their own limits ([REST › Rate limits](/docs/rest/#rate-limits)). Back off on `429` and honour `Retry-After`.
- The gateway pings every 54 seconds and closes a connection that does not answer within 60 seconds; every WebSocket library answers pings for you. See [Gateway › Heartbeat](/docs/gateway/#heartbeat).

## Bot etiquette on a federated network

Instances federate: a space on this instance may have members from other instances, and their messages reach your bot like any other. The bot itself is local to this instance - its token only works here, and it cannot be added to spaces hosted elsewhere. If you run a bot for communities on several instances, register it on each.
