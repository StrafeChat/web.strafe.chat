# E2EE Module

Signal-inspired end-to-end encryption for StrafeChat.

## Protocol (simplified X3DH)

- **X25519** identity key + signed prekey per device
- **ECDH** session key: `our_identity_private × their_signed_prekey`
- **HKDF-SHA256** to derive AES-256 key from shared secret
- **AES-256-GCM** for message encryption
- **Wire format**: `sender_identity_public || iv || ciphertext` (recipient derives key from header)

## Fallback

When recipient has no devices: `PLAINTEXT:` prefix, message stored in cleartext, UI shows "Not encrypted".

## Roadmap

- [ ] Ed25519 signed prekey signature
- [ ] One-time prekeys for forward secrecy
- [ ] Double Ratchet for post-X3DH messaging
- [ ] Multi-device session management

## Federation

Current design stores ciphertext server-side; server never sees plaintext. For federation: relay ciphertext between instances; key exchange stays client-to-client.
