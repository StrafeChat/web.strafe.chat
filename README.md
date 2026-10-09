## Usage

Those templates dependencies are maintained via [pnpm](https://pnpm.io) via `pnpm up -Lri`.

This is the reason you see a `pnpm-lock.yaml`. That being said, any package manager will work. This file can be safely be removed once you clone a template.

```bash
$ npm install # or pnpm install or yarn install
```

### Learn more on the [Solid Website](https://solidjs.com) and come chat with us on our [Discord](https://discord.com/invite/solidjs)

## Available Scripts

In the project directory, you can run:

### `npm run dev` or `npm start`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>

### `npm run build`

Builds the app for production to the `dist` folder.<br>
It correctly bundles Solid in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

## Deployment

You can deploy the `dist` folder to any static host provider (netlify, surge, now, etc.)

## This project was created with the [Solid CLI](https://github.com/solidjs-community/solid-cli)

## Desktop app

The native app lives in [StrafeChat/desktop](https://github.com/StrafeChat/desktop): a
[Tauri 2](https://v2.tauri.app/) shell with this repository as its `web/` submodule, so the
desktop app is this client with a native shell around it. Building, releasing and the icons
are documented there. The half that runs inside the webview is here, gated on `isDesktop()`:
`src/desktop/` (environment, the instance override, the account store, the updater and the
native bridges) and `src/components/desktop/` (title bar, account switcher, instance picker,
update banner), plus `src/components/settings/DesktopSettingsPage.tsx`.

### What is different inside the app

- The API, gateway and CDN addresses come from the chosen instance (`.well-known/strafe`),
  not from `config.js`; `src/lib/runtimeConfig.ts` reads `src/desktop/instanceOverride.ts`
  first. Instances admit the app's webview origins (`tauri://localhost`,
  `http(s)://tauri.localhost`) without any operator configuration.
- Accounts are kept in `accounts.json` under the app's config directory (owner-only),
  written by the Rust side; switching writes one account's token and instance into
  localStorage and reloads, so no store can leak between accounts.
- Passkeys cannot be used as a second factor in the app (WebAuthn binds to the page's
  origin, which is not the instance's domain); TOTP and recovery codes work. A hosted
  captcha (Turnstile, Friendly) must allow the host `tauri.localhost` / `localhost` in its
  site settings; the default ALTCHA needs nothing.
- Voice and video work in the Linux app from Strafe Desktop v1.2.0 on, which bundles a
  WebKitGTK built with WebRTC (no distribution ships one; see `scripts/build-webrtc-stack.sh`
  in StrafeChat/desktop). An older AppImage cannot make calls at all - the engine it carries
  has no `RTCPeerConnection` - and says so when one is tried. Windows (WebView2) and macOS
  were never affected.
