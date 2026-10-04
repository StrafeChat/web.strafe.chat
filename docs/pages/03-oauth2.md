---
title: OAuth2
description: The authorization code flow step by step, every scope, the token, refresh and revoke endpoints, and adding users to spaces with spaces.join.
---

# OAuth2

Strafe is an OAuth2 authorization server (RFC 6749). An application sends a person to the instance's consent page; if they approve, the application receives a short-lived **code**, exchanges it for an **access token** with its client secret, and uses that token to call the API on the person's behalf - limited to the **scopes** they approved.

Only the **authorization code** grant is offered, and clients must be confidential (the token endpoint requires the client secret). The consent page is part of the Strafe web client, so it is always at the instance's own domain:

<code data-instance="web" data-suffix="/oauth2/authorize">https://your-instance.example/oauth2/authorize</code>

## The flow

```text
 Your app                        Strafe (this instance)                    Person
    │ 1. redirect to /oauth2/authorize?client_id=…&scope=…&redirect_uri=… │
    │──────────────────────────────────────────────────────────────────────▶│
    │                              2. signs in (if needed), sees the scopes │
    │                              3. approves                              │
    │ 4. GET redirect_uri?code=…&state=…                                    │
    │◀──────────────────────────────────────────────────────────────────────│
    │ 5. POST /oauth2/token (code + client secret)                          │
    │─────────────────────────▶│                                            │
    │ 6. { access_token, refresh_token, … }                                 │
    │◀─────────────────────────│                                            │
    │ 7. GET /users/@me with Authorization: Bearer access_token             │
```

### 1. Send the person to the consent page

```text
https://your-instance.example/oauth2/authorize
  ?response_type=code
  &client_id=2104652899186380800
  &redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback
  &scope=identify%20email
  &state=b1f3c0a9
```

| Parameter | Required | Meaning |
| --- | --- | --- |
| `response_type` | yes | Always `code` |
| `client_id` | yes | Your application's client ID |
| `redirect_uri` | yes (unless the scope is only `bot`) | Where to send the person afterwards. Must be one of the application's registered redirect URIs, matched exactly |
| `scope` | yes | Space-separated [scopes](#scopes) |
| `state` | recommended | An opaque value you generate per request; it comes back unchanged so you can tie the redirect to the session that started it and reject forged callbacks |
| `permissions`, `space_id`, `disable_space_select` | with `bot` | See [Applications › Install links](/docs/applications/#install-links) |

If the person is not signed in they are asked to sign in first and then land on the consent page.

### 2–4. The redirect

On approval the browser is sent to your `redirect_uri` with:

| Query parameter | Present |
| --- | --- |
| `code` | Always. Single use, valid for **10 minutes** |
| `state` | If you sent one |
| `space_id`, `permissions` | When the request included the `bot` scope: the space the bot was added to and the permissions it actually received |

On refusal you get `?error=access_denied` (and `state`). Treat a missing or mismatched `state` as an error.

### 5. Exchange the code

`POST /oauth2/token`. The client authenticates with its ID and secret, either as **HTTP Basic** (`Authorization: Basic base64(client_id:client_secret)`) or as `client_id` / `client_secret` fields in the body. The body may be `application/x-www-form-urlencoded` (the standard) or JSON.

```bash
curl -X POST <API>/oauth2/token \
  -u "2104652899186380800:$CLIENT_SECRET" \
  -d grant_type=authorization_code \
  -d code=6d8f…e2 \
  -d redirect_uri=https://app.example.com/callback
```

```json
{
  "access_token": "b4f1…c9",
  "token_type": "Bearer",
  "expires_in": 604800,
  "refresh_token": "0a72…44",
  "scope": "identify email"
}
```

The `redirect_uri` must be the one used in step 1. Access tokens live **7 days**. The response is sent with `Cache-Control: no-store`; store both tokens server-side.

### 6. Use the token

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" <API>/users/@me
```

```json
{
  "id": "2102223172425220096",
  "username": "unreadtester1",
  "display_name": "unreadtester1",
  "email": "unread-tester-1@example.com",
  "avatar": "",
  "banner": "",
  "bio": "",
  "about_me": "",
  "accent_color": "",
  "public_flags": 0,
  "bot": false,
  "presence": { "status": "online" }
}
```

`email` is only filled in with the `email` scope; without it the field is `""`.

## Scopes

A token can only reach the endpoints its scopes name. Every other endpoint answers `403` with `{"error": "insufficient_scope"}` and a `WWW-Authenticate` header explaining which scope it needs. Unknown scopes are rejected at the consent page with `invalid_scope`.

| Scope | Grants | Endpoints |
| --- | --- | --- |
| `identify` | The person's id, username, display name, avatar, banner, bio, about me, badges (`public_flags`) - **not** their email | `GET /users/@me` |
| `email` | Their email address as well | `GET /users/@me` (adds `email`) |
| `spaces` | The spaces they are in, whether they own each, and their permissions there | `GET /users/@me/spaces` |
| `spaces.join` | Lets a bot of yours add them to a space, without an invite | `PUT /spaces/:id/members/:user_id` (called by the bot) |
| `bot` | Adds the application's bot to a space the person manages, with a chosen permission set | The consent page itself; see [Install links](/docs/applications/#install-links) |

Any token may call `GET /oauth2/@me` to see what it is.

> [!NOTE]
> Scopes are deliberately narrow. An OAuth2 token can never read messages, post, or change the account - those need the person's own client or a bot the person installed. Request only what you use: the consent page lists every scope in plain words.

## Refreshing

When the access token expires (or before), trade the refresh token for a new pair. The old pair stops working the moment the new one is issued.

```bash
curl -X POST <API>/oauth2/token \
  -u "2104652899186380800:$CLIENT_SECRET" \
  -d grant_type=refresh_token \
  -d refresh_token=0a72…44
```

The response has the same shape as the code exchange.

> [!IMPORTANT]
> **One live token pair per person per application.** Each new authorization (a person going through the consent page again) also replaces the previous pair. That is what makes **Revoke access** in the person's *Settings → Authorized Apps* mean the whole application, not just its newest token.

## Revoking

`POST /oauth2/token/revoke` (RFC 7009) with the same client authentication as the token endpoint and a `token` field holding either the access or the refresh token. The pair dies and the person's grant is removed. Unknown tokens still get `200 {}`.

```bash
curl -X POST <API>/oauth2/token/revoke \
  -u "2104652899186380800:$CLIENT_SECRET" \
  -d token=$REFRESH_TOKEN
```

People can also revoke from their side: **Settings → Authorized Apps** lists every application they approved with its scopes, and *Revoke access* invalidates its tokens on the spot.

## Inspecting a token

`GET /oauth2/@me` with the token as Bearer:

```json
{
  "application": { "id": "2104652899186380800", "name": "Login With Strafe Demo", "description": "", "icon": "", "has_bot": false, "bot_public": false },
  "scopes": ["identify", "email"],
  "expires": "2026-10-07T03:41:56Z",
  "user": { "id": "2102223172425220096", "username": "unreadtester1", "display_name": "unreadtester1", "avatar": "", "public_flags": 0 }
}
```

`user` is present when the token has `identify` or `email`.

## Listing the person's spaces

`GET /users/@me/spaces` with the `spaces` scope:

```json
[
  {
    "id": "2102226824774811648",
    "name": "Unread Test Space 2",
    "name_acronym": "UTS",
    "icon": "",
    "banner": "",
    "owner": true,
    "permissions": 8388607
  }
]
```

`permissions` is the person's space-wide permission mask there (all bits for the owner). Bots may call this endpoint too, to see where they live.

## spaces.join: adding users to a space

Classic use: a "Join our community" button on your website. The person authorizes your application with `identify spaces.join`; your **bot**, which is in the space with **Create Invite** (or Manage Space / Administrator), then adds them:

```bash
curl -X PUT <API>/spaces/2102226824774811648/members/2102223763486539776 \
  -H "Authorization: Bot $BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"access_token": "<the person'"'"'s access token>"}'
```

| Status | Meaning |
| --- | --- |
| `201` | Added. Body: `{"space_id": "…", "user_id": "…"}` |
| `204` | They were already a member |
| `403 invalid_grant` | The access token is not this user's, or lacks `spaces.join` |
| `403 access_denied` | The caller lacks Create Invite there, or the user is banned from the space |
| `404` | No such space |

The join behaves exactly like redeeming an invite: the join notice is posted, `SPACE_MEMBER_ADD` goes to the space and `SPACE_CREATE` to the new member's other sessions.

## Error reference

| `error` | Where | Why |
| --- | --- | --- |
| `invalid_client` | token, revoke | Unknown client ID, or wrong secret |
| `invalid_grant` | token | Code unknown, already used, expired, issued to another client or another `redirect_uri`; refresh token unknown or not this client's |
| `invalid_scope` | consent | An unknown scope, or `bot` on an application without a bot |
| `invalid_request` | consent, token | Bad or missing parameters (`error_description` says which); a `redirect_uri` that is not registered |
| `unsupported_grant_type` | token | Only `authorization_code` and `refresh_token` exist |
| `unsupported_response_type` | consent | Only `code` exists |
| `access_denied` | redirect, consent | The person refused; or, for a bot install, the bot is private / the person lacks Manage Space / the bot is banned there |
| `insufficient_scope` | any API endpoint | The token is valid but its scopes do not cover this endpoint (status `403`) |
| `invalid_token` | `GET /oauth2/@me` | The token is unknown or expired (status `401`) |

## Building a client from scratch

The consent page is an ordinary page in the web client. If you are building a *client* (not a third-party app) and want your own consent UI, the two endpoints it uses are session-authenticated:

- `GET /oauth2/authorize/info?response_type=code&client_id=…&redirect_uri=…&scope=…&permissions=…` returns the application, the parsed scopes and, for `bot`, the bot plus the spaces the signed-in person could add it to (each with the permissions they may grant there).
- `POST /oauth2/authorize` with the same fields as JSON (plus `space_id` and `permissions` for a bot install) records the approval and returns `{"location": "<redirect with code>", "space_id"?, "permissions"?}`; `location` is `""` for a bare bot install.
