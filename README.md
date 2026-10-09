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

The same client, wrapped in a native shell with [Tauri 2](https://v2.tauri.app/): `src-tauri/`
is the Rust side, `src/desktop/` the half that runs in the webview. One build works with
every Strafe instance - the sign-in page asks which one, and the account switcher in the
user menu holds accounts from any number of them. The desktop app adds what a browser tab
cannot: its own title bar, a tray icon (closing the window keeps you reachable), system
notifications with a taskbar badge for unread mentions, launch at start-up, links opening
in your browser, and in-app updates.

```bash
npm install
npm run desktop:dev     # the app against the Vite dev server on :3000

# A release build signs its update artifacts, so it needs the private key (see Releasing);
# without it `tauri build` stops before bundling.
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/strafe-desktop.key)"
npm run desktop:build                        # every bundle for this OS
npm run desktop:build -- --bundles appimage  # Linux: just the AppImage
```

Output lands in `src-tauri/target/release/bundle/`: `appimage/Strafe_<version>_amd64.AppImage`
(plus `deb/` and `rpm/`) on Linux, `nsis/Strafe_<version>_x64-setup.exe` (plus `msi/`) on
Windows, `dmg/` and `macos/` on macOS. An installer is built on the OS it is for; the release
workflow below builds all of them at once.

Build dependencies: Linux needs WebKitGTK and the tray library - Debian/Ubuntu
`libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`, Arch/CachyOS
`webkit2gtk-4.1 libayatana-appindicator librsvg patchelf` (plus `base-devel`); macOS Xcode's
command line tools; Windows the Visual Studio C++ build tools and WebView2 (preinstalled on
Windows 10+). The Rust toolchain comes from [rustup](https://rustup.rs).

### Releasing

Installed copies look for updates at
`https://github.com/StrafeChat/web.strafe.chat/releases/latest/download/latest.json`, which
`.github/workflows/desktop-release.yml` produces: bump `version` in `package.json`, commit,
and push a tag `desktop-v<version>`. The workflow builds Windows, macOS (both chips) and
Linux installers, signs them, and opens a **draft** release; publish it once an installer has
been tried, and every app checks in within a few hours.

Updates are signed with a minisign key. The public half is `plugins.updater.pubkey` in
`src-tauri/tauri.conf.json`; the private half is the repository secret
`TAURI_SIGNING_PRIVATE_KEY` (plus `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, empty if the key
has none). Keep it safe: a lost private key means a new public key, and apps installed with
the old one stop updating until reinstalled. Generate a pair with
`npx tauri signer generate -w ~/.tauri/strafe-desktop.key`.

### Icons

The app icon is the turtle in `branding/strafe-turtle.png` on a background in the app's own
theme. `python3 branding/make-icons.py` rebuilds `branding/icon-1024.png` and the web icons in
`public/icons/`; `npx tauri icon branding/icon-1024.png -o src-tauri/icons` then derives the
desktop set (.icns, .ico and every PNG size) from the master.

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
