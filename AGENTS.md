# web.strafe.chat — AGENTS.md

`web.strafe.chat` is StrafeChat's web client, built with Solid.js. If you only have this
repo checked out, read this whole file before making changes — it's self-contained. The
full project (this repo, the Go backend, object storage, deployment) is normally
developed side by side; if you have that workspace too, its root `AGENTS.md` has the
complete picture.

## Mission — why this client exists

StrafeChat is a Discord-alternative built around: **privacy** (minimum data collection, no
trackers, no silent telemetry), **real end-to-end encryption** (an actual ratchet, not a
static key — the E2EE layer under `src/lib/e2ee` is mid-overhaul toward a real
vodozemac-based Olm/Megolm implementation), **federation** (independent instances, no
single "official" server), **self-hosting** (this client must run against any instance's
API, configured via env, not hardcoded to one deployment), and **client customization** —
this repo owns that last one directly: themes, accessibility, notifications, keybinds,
appearance are first-class settings, not afterthoughts. Don't trade any of these away for
convenience — flag the conflict instead.

## Terminology

We reuse Discord's interaction model, never its names. Use these everywhere — component
names, store fields, UI copy, i18n keys:

| Discord term | Our term |
|---|---|
| Server / Guild | **Space** |
| Channel | **Room** |
| Category | **Section** — not built yet; use this name when it is |
| DM | **PM** — sidebar label is "Private Messages" |
| AFK channel | UI copy says "inactive voice channel," not "AFK" |
| Server Widget | UI copy says "space widget" |

Never introduce "Server," "Guild," "Channel," "Category," or "DM" into user-facing copy or
new i18n keys.

## Architecture conventions — follow these, don't reinvent them

- **State**: one `createStore` per domain in `src/stores/*.ts` (`messages`, `spaces`,
  `rooms`, `customEmojis`, ...). Realtime sync goes through `onStargateEvent(...)`
  inside an `initXHandler()` function that's called once at app init (see `App.tsx` /
  `AppShell.tsx`) — don't subscribe to gateway events from inside a component.
- **API layer**: thin fetch wrappers in `src/api/*.ts` built on `api<T>()` from
  `src/api/client.ts`. A new endpoint gets a typed function here, not an inline `fetch`
  in a component.
- **Design tokens**: reuse what's in `src/theme/appChrome.ts` (`appTable*`,
  `appMenuPanel`, `appFloatToolbar`, `appDialogPanel`, `zLayer`, ...) instead of
  hand-rolling equivalent Tailwind classes — this keeps every modal, table, and popover
  visually consistent. Add a new token there if an existing one doesn't fit, rather than
  writing one-off styles in a component.
- **i18n**: all user-facing strings go through `t()` (`src/i18n`), defined in all six
  locale files under `src/i18n/locales/` (en, es, fr, de, pt-BR, ar) — never partially.
  Countable strings use the `key_one`/`key_other` suffix convention (i18next-style);
  Arabic additionally needs `key_zero/_one/_two/_few/_many/_other`. A locale-parity check
  should show zero missing keys after you're done (only the expected plural-suffix
  differences are OK as "extra").
- **Permissions**: `src/lib/spacePermissions.ts` mirrors the backend's permission
  bitmask bit-for-bit. If a permission bit is added or renamed on the backend, update
  this file in the same change so the two don't drift.
- **Voice/video**: everything goes through `src/stores/voice.ts` - components never
  touch the LiveKit `Room` directly. Voice states and calls come from the server (READY,
  `VOICE_STATE_UPDATE`, `CALL_*`); the store only adds this device's connection, mic
  pipeline (`src/lib/voice/micPipeline.ts`), per-user volume and speaking flags. Map-shaped
  store fields (`speaking`, `media`, `byRoom`) are written with `produce`/`reconcile`, never
  a plain setter (which merges and keeps stale keys - that bug shipped once). One
  48 kHz `AudioContext` per call carries both capture and playback (`webAudioMix` with
  our context); it must be created/resumed *synchronously* in the click that joins, or
  Safari keeps it suspended and the call is silent until a tap. Noise suppression is
  RNNoise in an AudioWorklet (`src/lib/voice/rnnoise.ts`, bundled WASM, runs locally);
  Opus DTX stays off (comfort-noise switching audibly pulses). Tiles get measured pixel
  sizes from `fitTiles` (a CSS aspect ratio ignored the stage height and overflowed the
  controls). UI lives in `src/components/voice/`; `docs/VOICE.md` explains the whole
  flow.
- **Call media is E2EE.** Per-sender keys (`src/lib/e2ee/callKeys.ts`) travel Olm-encrypted
  over the to-device channel and feed LiveKit's key provider (`src/lib/voice/e2ee.ts`).
  When touching either: a peer's device list must be refreshed before encrypting or a
  member's *new* device never gets the key (the `markAllTrackedUsersAsDirty` throttle —
  this bit us once); the sender of an incoming key comes from the Olm decryption, never
  the payload; and there is no plaintext fallback, so never let a join proceed when
  encryption can't be set up.
- **Solid.js `<select>` gotcha**: the native `value` prop can silently fail to apply if
  set before/independent of its `<option>` children rendering. `src/components/ui/
  Select.tsx` already works around this with a `ref` + `createEffect` re-assert — don't
  regress it if you touch that component.
- **Reuse existing UI building blocks** before adding new ones: `EmojiPicker` (unicode +
  custom space emoji, already used by the composer and message reactions),
  `ResponsiveDialog`, `Tooltip`, `IconButton`, `UserCell`, the settings modal shells
  (`SettingsShell`/`SettingsNav`/`SettingsPanel`). Check `src/components/` for something
  close before writing a new component from scratch.

## Verification expectations

Before calling frontend work done: `npm run typecheck` and `npm run lint` must report no
errors. The lint config carries `eslint-plugin-solid`, which catches the bug class tsc
cannot: a component body runs once, so `props.x ? a : b` or an early `return` there freezes
at its mount-time value (a `<Show>` is the fix). Treat a `solid/reactivity` warning on a
`props.*` read or an early return as a real bug; the ones on imperative store reads inside
promise callbacks and event handlers are known false positives. Then actually start
the dev server and exercise the feature in a browser — click through the golden path and
at least one edge case, and check the console for new errors. Type-checking verifies code
correctness, not feature correctness; don't claim a UI change works without having seen it
render.
