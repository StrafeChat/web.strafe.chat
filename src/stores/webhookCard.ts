import { createStore } from 'solid-js/store';
import type { BridgedIdentity } from '../lib/webhookMessages';

/**
 * The card a webhook message's name or avatar opens (components/WebhookCard): who the message
 * shows as, that it is a webhook, which room it posts into and - for viewers who manage the
 * room's webhooks - who made it. Never a person's profile: a webhook has none.
 */
export interface WebhookCardSubject {
  webhookId: string;
  name: string;
  avatar?: string;
  spaceId?: string;
  roomId?: string;
  /** A bridged person (masquerade through a bridge): their stable id and their bridge. */
  puppetId?: string;
  bridge?: BridgedIdentity;
  /** `#rrggbb` name colour, when their bridge allows colours. */
  colour?: string;
  /** May the viewer block a bridged person from the bridge (Kick Members, or Manage
   * Messages in the room)? The server decides; this only decides what is offered. */
  canBlock?: boolean;
  /** Open a Strafe account's card (the bot behind a bridge, the member who shares a name),
   * from the surface that opened this one - it knows the room's people and roles. */
  openUser?: (userId: string, anchor: HTMLElement) => void;
}

interface WebhookCardState {
  open: boolean;
  subject: WebhookCardSubject | null;
  anchor: { top: number; bottom: number; left: number; right: number } | null;
}

export const [webhookCard, setWebhookCard] = createStore<WebhookCardState>({ open: false, subject: null, anchor: null });

export function openWebhookCard(subject: WebhookCardSubject, anchor: HTMLElement): void {
  const r = anchor.getBoundingClientRect();
  setWebhookCard({ open: true, subject, anchor: { top: r.top, bottom: r.bottom, left: r.left, right: r.right } });
}

export function closeWebhookCard(): void {
  setWebhookCard({ open: false, subject: null, anchor: null });
}
