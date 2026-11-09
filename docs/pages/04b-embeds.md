---
title: Embeds
description: Rich embeds on a bot's messages - the embed object and its limits, images from attachment:// and the instance's image proxy, editing, permissions, errors, and Node.js and Python examples.
slug: embeds
---

# Embeds

An **embed** is the card a bot attaches to its message: a coloured edge, an author line, a title that links somewhere, a Markdown description, a grid of fields, a large image, a small thumbnail and a footer with a timestamp. It is Discord's rich embed, field for field, so the objects a Discord bot already builds work here unchanged.

- A message carries up to **10** embeds, with or without text.
- Only **bot** accounts send them, and only in **plain** rooms (not end-to-end encrypted).
- In a space room the bot needs **Embed Links** on top of **Send Messages** ([Permissions](/docs/permissions/)). Private messages need no bit.

```json
{
  "plaintext": "Build finished",
  "embeds": [
    {
      "author": { "name": "CI", "icon_url": "https://ci.example.org/logo.png" },
      "title": "strafe/web #1842 passed",
      "url": "https://ci.example.org/builds/1842",
      "description": "All **312** checks passed. [Open the log](https://ci.example.org/builds/1842/log)",
      "color": 3066993,
      "fields": [
        { "name": "Branch", "value": "`main`", "inline": true },
        { "name": "Commit", "value": "`a1b2c3d`", "inline": true },
        { "name": "Took", "value": "4m 12s", "inline": true }
      ],
      "thumbnail": { "url": "https://ci.example.org/badge.png" },
      "footer": { "text": "ci.example.org" },
      "timestamp": "2026-11-02T18:30:00Z"
    }
  ]
}
```

Send it as the body of `POST /rooms/:id/messages` ([Bots › Sending messages](/docs/bots/#sending-messages)). Embed builders from Discord libraries produce this object as it is: discord.js `new EmbedBuilder()…toJSON()`, discord.py `discord.Embed(…).to_dict()`.

## The embed object

Every field is optional, but an embed must have something to show: a title, description, fields, author, footer, image or thumbnail.

| Field | Type | |
| --- | --- | --- |
| `title` | string | Up to 256 characters. A link when `url` is set |
| `description` | string | Up to 4096 characters. Markdown, as in message text |
| `url` | string | Where the title links (http or https) |
| `timestamp` | string | An RFC 3339 time, shown in the footer in each reader's own time zone |
| `color` | integer | The edge colour, `0xRRGGBB` (0 to 16777215) |
| `author` | object | `name` (required, up to 256), `url` (makes the name a link), `icon_url` |
| `fields` | array | Up to 25 `{"name", "value", "inline"}`. `name` (up to 256) and `value` (up to 1024) are required |
| `image` | object | `{"url"}`: the large picture under the text |
| `thumbnail` | object | `{"url"}`: the small picture at the top right |
| `footer` | object | `text` (required, up to 2048), `icon_url` |

`type`, `provider`, `video`, and any `width`, `height`, `proxy_url` or `proxy_icon_url` you send are ignored: the server fills in what it serves.

### Limits

| Rule | |
| --- | --- |
| Embeds per message | 10 |
| Text over **all** of a message's embeds | 6000 characters: titles, descriptions, field names and values, footer texts and author names together |
| How text is counted | Characters (Unicode code points), after trimming leading and trailing whitespace |
| URLs | `http` or `https` (images may also be `attachment://`, below), at most 2048 bytes, no `user:password@`. A `#fragment` is dropped |

### How it renders

- **Title** and **field names**: bold, italic, underline, strikethrough, inline code and emoji. No links or mentions.
- **Description** and **field values**: everything message text can do - lists, quotes, code blocks, spoilers, emoji, timestamps (`<t:1767225600:R>`) - plus masked links, `[text](https://…)`. A reader who opens a masked link is shown its real address first.
- **Author name** and **footer text**: plain text.
- **Fields**: consecutive fields with `"inline": true` share a row, up to three to a row (two when the embed has a thumbnail). A field without `inline` takes a whole row.
- **Mentions** (`<@id>`, `<@&id>`, `<#id>`) written in an embed render as mentions but **never notify anyone** and are not part of the message's `mentions`. Ping people from `plaintext`.
- The message is still shown under the bot's name with its **BOT** tag; the embed's `author` line is only text.

> [!NOTE]
> Readers can turn embeds off (**Settings → Appearance → Show embeds from bots**). Keep what matters readable without the card, or say it in `plaintext` too. A push notification for a message without text shows the first embed's title or description.

## Images

A Strafe client never loads an embed's picture from the address you gave: that would show every reader's IP address to whatever site hosts it, each time they scrolled past. A picture reaches readers one of two ways.

**From your own upload (`attachment://`).** Upload the image first, put its id in the message's `attachments`, and name it in the embed as `attachment://<filename>` or `attachment://<attachment id>`. It must be a png, jpeg, gif or webp image uploaded by the bot into the same room. The server resolves it to the file's address on this instance's own storage, and clients do not show it a second time in the message's list of files. A file name used by two of the message's attachments must be given by id instead.

**From any http(s) address, through the image proxy.** The instance fetches the picture itself and serves readers its own copy: what it serves carries your `url` and, beside it, `proxy_url` (for `author` and `footer`, `proxy_icon_url`), which is what clients load. The instance fetches each new picture when the message is posted or edited, so the site sees one request from the instance, never one per reader: no cookies, no referer, the user agent `Mozilla/5.0 (compatible; StrafeChat-MediaProxy/1.0; +https://strafe.chat)`, at most 5 redirects and 10 seconds. Only png, jpeg, gif and webp are served (judged from the bytes, not the address or the site's `Content-Type`), up to the instance's size limit (8 MB unless its operator changed it) and 16384 pixels a side; anything else simply does not show. A picture that could not be fetched is not tried again for 15 minutes.

If an instance's operator turned the proxy off, outside pictures arrive without `proxy_url`, and clients show a placeholder naming the site, which loads the picture only when the reader asks. Pictures uploaded with `attachment://` always show.

```bash
# 1. Upload the image into the room.
curl -X POST <API>/rooms/ROOM_ID/attachments \
  -H "Authorization: Bot $BOT_TOKEN" \
  -F "file=@chart.png" -F "width=1200" -F "height=600"
# → {"id": "2105150001234567890", "filename": "chart.png", ...}

# 2. Post the message that shows it in an embed.
curl -X POST <API>/rooms/ROOM_ID/messages \
  -H "Authorization: Bot $BOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"attachments": ["2105150001234567890"],
       "embeds": [{"title": "Messages this week", "image": {"url": "attachment://chart.png"}}]}'
```

## Receiving embeds

Every message the API serves - `MESSAGE_CREATE` and `MESSAGE_UPDATE` on the gateway, and every REST response with a message in it - carries `embeds`: an array, empty when there are none. Each embed comes back with `"type": "rich"` and the fields it was sent with, after the server's clean-up (trimmed text, canonical URLs, `attachment://` resolved to the file's address, the timestamp in UTC). The server adds:

| Where | Field | |
| --- | --- | --- |
| `image`, `thumbnail` | `proxy_url` | The address to load the picture from: this instance's copy, or the file itself when it is already on this instance's storage |
| `image`, `thumbnail` | `width`, `height` | The picture's size, once the instance has fetched it. There is no gateway event for this: the `MESSAGE_CREATE` usually comes before the fetch has finished, and later REST responses carry the size |
| `author`, `footer` | `proxy_icon_url` | The same, for the icon |

For a picture from elsewhere, `proxy_url` is an address on the instance's image proxy, `<API>/media/v1/external/<signature>/<source>`. It needs no token (the signature is what lets it through), so a bot can fetch it like any image. On an instance that has not configured its public URL it is a path starting with `/media/v1/`: resolve it against the API base you use. `proxy_url` is computed by whichever instance serves the message, so do not store it: ask again for a message you need later. In a space hosted on another instance, embeds come from that instance with the message and this instance serves them through its own proxy.

```json
"embeds": [
  {
    "type": "rich",
    "title": "Messages this week",
    "image": {
      "url": "https://your-instance.example/cdn/v1/attachments/…/chart.png",
      "proxy_url": "https://your-instance.example/cdn/v1/attachments/…/chart.png",
      "width": 1200,
      "height": 600
    }
  }
]
```

## Editing

`PATCH /rooms/:id/messages/:msg_id` edits one of the bot's own messages:

| Body | Effect on the embeds |
| --- | --- |
| `"embeds": [ … ]` | Replaces the whole list |
| `"embeds": []` or `"embeds": null` | Removes them all |
| no `embeds` key | Keeps them as they are |

`{"embeds": [ … ]}` alone is a complete edit: the text stays as it was. Only the message's author edits its embeds, and the same rules apply as when sending (a bot, a plain room, Embed Links). An `attachment://` in an edit names one of the files the message already carries.

## Errors

A refused embed answers `400` with a `code` and the `path` of the first field the server refused:

```json
{
  "error": "embeds[0].fields[3].value: can be at most 1024 characters",
  "code": "invalid_embed",
  "path": "embeds[0].fields[3].value"
}
```

| Status | `error` | When |
| --- | --- | --- |
| `400` | `<path>: <reason>` with `"code": "invalid_embed"` | A limit, a URL, a timestamp, a colour, a missing required field, an embed with nothing to show, an `attachment://` that names no image of the message |
| `400` | `embeds are for bots` | A person's account sent `embeds` |
| `400` | `embeds cannot be sent in an end-to-end encrypted room` | The room is end-to-end encrypted |
| `403` | `missing permission to embed links in this channel` | No **Embed Links** in this space room |

## Examples

Both build on the bots in [Bots](/docs/bots/#a-complete-bot-in-node-js): they answer `!status` with a card and post a chart the bot uploaded.

```js
const TOKEN = process.env.BOT_TOKEN;
const API = process.env.STRAFE_API; // e.g. https://chat.example.org/api
const headers = { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' };

async function send(roomId, body) {
  const res = await fetch(`${API}/rooms/${roomId}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // An invalid embed says which field: err.path, e.g. "embeds[0].title".
    throw new Error(`send failed: ${res.status} ${err.path ?? ''} ${err.error ?? ''}`);
  }
  return res.json();
}

// In the gateway handler: if (t === 'MESSAGE_CREATE' && d.plaintext === '!status') await status(d.room_id);
async function status(roomId) {
  return send(roomId, {
    embeds: [{
      title: 'All systems normal',
      color: 0x2ecc71,
      fields: [
        { name: 'API', value: '✅ 42 ms', inline: true },
        { name: 'Gateway', value: '✅ 18 ms', inline: true },
        { name: 'Uptime', value: '12 days', inline: true },
      ],
      footer: { text: 'status bot' },
      timestamp: new Date().toISOString(),
    }],
  });
}

// Upload a PNG (a Buffer) and show it in an embed with attachment://.
async function postChart(roomId, png) {
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'chart.png');
  const up = await fetch(`${API}/rooms/${roomId}/attachments`, { method: 'POST', headers: { Authorization: `Bot ${TOKEN}` }, body: form });
  if (!up.ok) throw new Error(`upload failed: ${up.status}`);
  const file = await up.json();
  return send(roomId, {
    attachments: [file.id],
    embeds: [{ title: 'Messages this week', color: 0x5865f2, image: { url: 'attachment://chart.png' } }],
  });
}

// Replace a message's embeds later (the text stays).
async function editEmbeds(roomId, messageId, embeds) {
  const res = await fetch(`${API}/rooms/${roomId}/messages/${messageId}`, { method: 'PATCH', headers, body: JSON.stringify({ embeds }) });
  if (!res.ok) throw new Error(`edit failed: ${res.status} ${await res.text()}`);
  return res.json();
}
```

The same in Python (`pip install requests`):

```python
import os, requests
from datetime import datetime, timezone

TOKEN = os.environ["BOT_TOKEN"]
API = os.environ["STRAFE_API"]
HEADERS = {"Authorization": f"Bot {TOKEN}"}

def send(room_id, body):
    r = requests.post(f"{API}/rooms/{room_id}/messages", json=body, headers=HEADERS, timeout=10)
    if r.status_code == 400 and r.json().get("code") == "invalid_embed":
        raise ValueError(f"invalid embed at {r.json()['path']}: {r.json()['error']}")
    r.raise_for_status()
    return r.json()

def status(room_id):
    return send(room_id, {"embeds": [{
        "title": "All systems normal",
        "color": 0x2ECC71,
        "fields": [
            {"name": "API", "value": "✅ 42 ms", "inline": True},
            {"name": "Gateway", "value": "✅ 18 ms", "inline": True},
            {"name": "Uptime", "value": "12 days", "inline": True},
        ],
        "footer": {"text": "status bot"},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }]})

def post_chart(room_id, path="chart.png"):
    with open(path, "rb") as f:
        up = requests.post(f"{API}/rooms/{room_id}/attachments", headers=HEADERS,
                           files={"file": ("chart.png", f, "image/png")}, timeout=30)
    up.raise_for_status()
    return send(room_id, {
        "attachments": [up.json()["id"]],
        "embeds": [{"title": "Messages this week", "image": {"url": "attachment://chart.png"}}],
    })

def edit_embeds(room_id, message_id, embeds):
    r = requests.patch(f"{API}/rooms/{room_id}/messages/{message_id}", json={"embeds": embeds},
                       headers=HEADERS, timeout=10)
    r.raise_for_status()
    return r.json()
```
