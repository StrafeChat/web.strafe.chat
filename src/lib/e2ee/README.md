# E2EE Module

Real end-to-end encryption for StrafeChat, built on [vodozemac](https://github.com/matrix-org/vodozemac)
(Matrix's audited Rust implementation of Olm/Megolm) via the official
[`@matrix-org/matrix-sdk-crypto-wasm`](https://github.com/matrix-org/matrix-sdk-crypto-wasm)
WASM bindings - not a hand-rolled protocol. The previous version of this module used
correct primitives (X25519, AES-256-GCM, HKDF) wired into a protocol with no real
authentication and no ratchet; see git history on this file for that design and why it
was replaced.

## Protocol

- **Olm** (Double Ratchet, Signal-equivalent): 1:1 sessions between devices, used for
  to-device messages - Olm/Megolm session setup, room-key distribution, revocation
  notices. Real forward secrecy and post-compromise security via continuous DH ratchet
  steps, unlike a one-shot ECDH.
- **Megolm**: actual chat content for every room - PMs, group PMs, and opt-in E2EE space
  channels. A PM is just a 2-member room; there's no separate raw-Olm-per-message
  transport for chat content, since Megolm gives forward secrecy per message and (unlike
  a bespoke to-device chat transport) is compatible with this app's existing persisted,
  paginated, editable message history. What actually makes PMs "the highest encryption"
  per-conversation is that a 2-member room's session only ever needs re-sharing with one
  other party, so it can be rotated far more aggressively than a large group's can.
- **Ed25519** device signing key, real signatures this time - `RegisterDevice`'s old
  "signature" was literally a slice of the public key. The server stores/relays key
  material opaquely and verifies nothing (per the Signal/Matrix threat model the server
  is untrusted; the *client* verifies bundles before trusting them).
- **Safety numbers** (`safety.ts`): per-device Ed25519 fingerprint comparison, the
  out-of-band backstop that makes the signature fix meaningful - even a real signature
  only proves self-consistency, not that a given device belongs to who you think it does.

## Storage

The OlmMachine owns its own IndexedDB store internally, encrypted at rest with a random
per-device passphrase (see `machine.ts`) - not something this module manages by hand.
That's the fix for the old design storing raw private key bytes as plaintext in
IndexedDB. The recovery-PIN backup (`backup.ts`) protects that passphrase, not key
material directly - restoring from backup reopens the same encrypted store rather than
reconstructing keys from the backup payload.

## Wire format / legacy compatibility

`constants.ts` prefixes discriminate ciphertext format. `PLAIN:` (no recipient devices,
stored in cleartext, UI shows "Not encrypted") and `MEGOLM1:`/`OLM1:` are the current wire
formats. The old `DUAL:`/`GROUP:` prefixes (and pre-prefix raw ciphertext) are detected via
`isLegacyCiphertext()` but are **not decryptable by this engine** - the old scheme's
decrypt logic and its IndexedDB key store (`crypto.ts`/`store.ts`) were deleted along with
it, not carried forward, since the new engine's OlmMachine owns a completely different
storage model. The UI shows those messages with a distinct "encrypted with a retired
scheme" placeholder rather than attempting (and failing) to decrypt them. There's also no
way to re-encrypt old messages into the new format even in principle - that needs the old
scheme's session key, which by design a real ratchet doesn't let you reconstruct.

## Transport

The OlmMachine is a "no network IO" state machine: `outgoingRequests()` returns what it
wants sent (key uploads/queries/claims, to-device messages), the app relays those and
feeds results back via `markRequestAsSent`/`receiveSyncChanges` (`transport.ts`). Request
bodies are the standard Matrix Client-Server API shape the machine itself
produces/expects - equinox's `/devices/*` endpoints speak that same shape (not Matrix
federation, just the same well-documented wire contract) rather than a bespoke one.

## Known gaps / explicit non-goals for this pass

- No cross-signing - verification is per-device (`safety.ts`), not Element-style
  per-user cross-signed trust. A meaningfully smaller feature to build correctly than
  full cross-signing, and sufficient for a real out-of-band verification story.
- No browser-native MLS for spaces - not production-ready for vanilla web JS yet as of
  this writing. Space channels reuse Megolm (opt-in per channel via `rooms.e2ee_enabled`)
  rather than defaulting E2EE on, since large/public community channels routinely need
  moderation, search, and bots - the same reason Discord's own E2EE effort (DAVE) covers
  voice/video only, never server text channels.
- No E2EE for voice/video - no calling implementation exists in this codebase yet.
