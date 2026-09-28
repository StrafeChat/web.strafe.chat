import type { Component } from 'solid-js';
import { onCleanup, onMount } from 'solid-js';

/**
 * Cloudflare Turnstile challenge, rendered only when the instance asks for one.
 *
 * Explicit render (rather than Turnstile's auto-scan of the page) so the widget's lifetime
 * follows the component: a failed registration can reset it, and leaving the page removes
 * it instead of leaving an orphan behind.
 */

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      theme?: 'auto' | 'light' | 'dark';
    }
  ) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise: Promise<void> | null = null;

/** Loads the Turnstile script once per page, however many widgets ask for it. */
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      const script = existing ?? document.createElement('script');
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error('turnstile script failed to load')), { once: true });
      if (!existing) {
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }).catch((e) => {
      // Let a later attempt retry rather than caching the failure forever.
      scriptPromise = null;
      throw e;
    });
  }
  return scriptPromise;
}

export interface TurnstileWidgetProps {
  siteKey: string;
  /** Called with a token when the challenge is solved, and with '' when it expires or errors. */
  onToken: (token: string) => void;
  /** Receives a reset function so the form can re-arm the widget after a failed submit. */
  onReady?: (reset: () => void) => void;
  /** Surface a load failure to the form, which should then explain rather than hang. */
  onLoadError?: () => void;
}

export const TurnstileWidget: Component<TurnstileWidgetProps> = (props) => {
  let host: HTMLDivElement | undefined;
  let widgetId: string | null = null;

  onMount(() => {
    let disposed = false;
    loadTurnstile()
      .then(() => {
        if (disposed || !host || !window.turnstile) return;
        widgetId = window.turnstile.render(host, {
          sitekey: props.siteKey,
          callback: (token) => props.onToken(token),
          // Both clear the token: a stale one is refused server-side anyway, and letting
          // the form think it still has a valid answer just produces a confusing 403.
          'expired-callback': () => props.onToken(''),
          'error-callback': () => props.onToken(''),
          theme: 'auto',
        });
        props.onReady?.(() => {
          props.onToken('');
          if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
        });
      })
      .catch(() => {
        if (!disposed) props.onLoadError?.();
      });

    onCleanup(() => {
      disposed = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      widgetId = null;
    });
  });

  return <div ref={(el) => (host = el)} class="flex justify-center" />;
};
