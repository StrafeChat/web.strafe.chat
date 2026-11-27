import { createSignal } from 'solid-js';

/**
 * The space's "Bridges" privacy dialog (space menu > Bridge privacy, the room header's bridge
 * panel): whether bridges may copy the signed-in person's messages in that space. Rendered
 * once by SpaceBridgeConsentDialog in the app shell.
 */
const [spaceBridgeConsentFor, setSpaceBridgeConsentFor] = createSignal<string | null>(null);
export { spaceBridgeConsentFor };

export function openSpaceBridgeConsent(spaceId: string): void {
  setSpaceBridgeConsentFor(spaceId);
}

export function closeSpaceBridgeConsent(): void {
  setSpaceBridgeConsentFor(null);
}
