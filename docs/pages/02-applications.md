---
title: Applications
description: Creating an application, its client ID and secret, adding a bot, public and private bots, redirect URIs, and building install links.
---

# Applications

An **application** is the thing you register to build on Strafe. It is an OAuth2 client (a client ID, a client secret and a list of redirect URIs) and it may own one **bot**: a real user account with `bot: true` that authenticates with a bot token instead of a password.

You manage applications in the Strafe client under **Settings → Developers**. Everything on that page is also available through the [REST API](/docs/rest/#applications-session-only) to a signed-in person's session, but not to bots or OAuth2 tokens.

## Creating an application

1. Open **Settings → Developers** and click **New Application**. The name is what people see on the consent screen and, once you add a bot, the bot's display name.
2. Copy the **client secret** from the banner. It is shown **once**; the server keeps only a hash. If you lose it, **Reset Secret** mints a new one (and breaks anything using the old one).
3. Set a **description** (shown on the consent screen) and, for OAuth2 sign-in, the **redirect URIs** your app will use - one per line, absolute `http(s)` URLs, up to 10. A redirect URI must match **exactly**, character for character, when you use it.

The **client ID** is the application's id. It is public - it appears in install links and authorization URLs.

## Adding a bot

Click **Add Bot** on the application. This creates the bot account and shows its **token** once. Two things are worth knowing:

- **The bot's user ID is the application's client ID.** Wherever the bot appears (a member list, a message's `sender_id`), that id is also the `client_id` of its install link, so anyone can add the bot without looking anything up.
- The bot's username is derived from the application's name (`Weather Bot` → `Weather_Bot`) and, if that username is taken, given a numeric suffix (`Weather_Bot2`); its display name is the application's name. Its avatar starts as the application's icon.

### The bot's profile

A bot has a full profile like anyone else - avatar, banner, display name, about me (the short line on its profile card) and bio (the longer text on its full profile). Edit them under **Bot profile** on the application page; changes show everywhere the bot appears, live. The same is available to the owner over the API: `PATCH /applications/:id/bot` with `display_name`, `about_me`, `bio` or `accent_color` (the usual profile limits apply), and `POST /applications/:id/bot/avatar` / `…/bot/banner` with a multipart `file`. Bots are always shown with a **BOT** tag right after their name, so a bot can never pass for a person.

**Reset Token** invalidates the current token immediately: any gateway connection using it receives `SESSION_REVOKED` and is closed, and REST calls with it get `401`.

### Public and private bots

The **Public bot** switch decides who may add the bot to a space:

- **On** (the default for new bots): anyone with **Manage Space** in a space can add it through an install link.
- **Off**: only the application's owner can. Other people opening the install link are told the bot is private.

Turn it off while a bot is in development, or for a bot that is only meant for your own spaces.

### What a bot can do

A bot is a member like any other: it can read the rooms its permissions allow, post messages, add reactions, and use every moderation endpoint its role permits. Its permissions come from its roles in each space, exactly like a person's - the [Permissions](/docs/permissions/) page explains how they resolve. Bots have no password and cannot sign in to the client; they also cannot create applications, authorize OAuth2 requests, or manage their own application.

## Install links

An install link is an authorization URL with the `bot` scope. Opening it shows the person a consent page where they pick one of the spaces they manage and review the permissions the bot asks for; approving adds the bot to that space.

The **URL generator** at the bottom of the application page builds one for you: tick `bot`, tick the permissions the bot needs, and copy the link. It looks like this:

```text
https://your-instance.example/oauth2/authorize
  ?response_type=code
  &client_id=2105141069376131072
  &scope=bot
  &permissions=8768
```

| Parameter | Meaning |
| --- | --- |
| `client_id` | The application's client ID (= the bot's user id) |
| `scope` | `bot`, optionally with other [scopes](/docs/oauth2/#scopes) (`bot identify` also signs the person in to your app) |
| `permissions` | The [permission bits](/docs/permissions/) the bot asks for, as one integer. Omit or `0` to join with no extra permissions |
| `space_id` | Optional: preselect a space in the picker |
| `disable_space_select=true` | With `space_id`: lock the picker to that space (it must be one the person can add bots to) |
| `redirect_uri`, `state` | Optional for a bare `bot` install; required as soon as another scope is present (the person is sent back with a `code`, plus `space_id` and `permissions` describing where the bot went) |

What happens on approval:

- The bot joins the space with the `@everyone` role and a **managed role** named after it, holding the granted permissions. Managed roles show a bot badge in the roles editor; they can be edited like any role but not deleted or given to anyone else, and they are removed when the bot leaves.
- The person may **uncheck** permissions they would rather not grant, and can never grant more than they hold themselves: the server intersects the request with what they may hand out (everything for the owner and Administrators).
- If the bot is already in the space, approving again re-applies the requested permissions to its managed role instead of adding it twice.
- The install is written to the space's **audit log** (`bot_add`).

The **Add to a space** button on the application page is the same thing with the permissions currently selected in the URL generator, for adding your own bot to a space you manage.

## Listing a bot on Discover

Every instance has a Discover page where people browse the spaces and bots listed there. To put your bot on it, open the application in **Settings → Developers**, scroll to **Discover**, write a one-line tagline and up to five tags, and apply. An instance administrator reviews the application; until they approve it the bot is not shown, and if they decline it their note appears in the same place so you can adjust and apply again. Only a **public** bot can be listed (see above), and the listing is per instance - a bot registered on another instance is listed there, not here. A listed bot's card opens its install page, so the permissions in your install link are what people will grant.

## Deleting an application

**Delete Application** removes the application, its client secret and its bot token. The bot account stays a member of the spaces it was added to until someone kicks it, but it can no longer authenticate, so it goes offline for good. Tokens people authorized for the application stop working.
