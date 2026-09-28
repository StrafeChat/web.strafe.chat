import type { Component } from 'solid-js';
import { onCleanup, onMount } from 'solid-js';
import 'altcha';
import { apiUrl } from '../../lib/runtimeConfig';
import { currentLanguage } from '../../i18n';
import type { CaptchaWidgetProps } from './CaptchaWidget';

/**
 * ALTCHA: a self-hosted proof-of-work challenge. This instance's API issues a signed
 * puzzle (GET /auth/captcha/challenge), the browser solves it in a Web Worker, and the API
 * checks the answer itself. Nothing leaves the instance and there is no account with anyone.
 *
 * The element is created imperatively rather than as JSX: it is a web component whose
 * properties are set after `customElements` has upgraded it, which is also the moment its
 * events become meaningful - so build it, configure it, then attach it.
 */
export const AltchaWidget: Component<CaptchaWidgetProps> = (props) => {
  let host: HTMLDivElement | undefined;

  onMount(() => {
    if (!host) return;
    const widget = document.createElement('altcha-widget');
    widget.challenge = `${apiUrl()}/auth/captcha/challenge`;
    widget.language = currentLanguage().split('-')[0];
    // Solve as soon as the form gets attention; a completed puzzle is then ready by the
    // time the user reaches the submit button.
    widget.auto = 'onfocus';
    // No hidden input: the payload goes through onToken into the JSON request body.
    widget.name = '';

    const onStateChange = (ev: Event) => {
      const detail = (ev as CustomEvent<{ state: string; payload?: string }>).detail;
      switch (detail.state) {
        case 'verified':
          props.onToken(detail.payload ?? '');
          break;
        case 'error':
        case 'expired':
        case 'unverified':
          // A stale payload is refused server-side anyway; keep the form's view honest.
          props.onToken('');
          break;
      }
    };
    widget.addEventListener('statechange', onStateChange);
    host.appendChild(widget);

    props.onReady?.(() => {
      props.onToken('');
      widget.reset();
    });

    onCleanup(() => {
      widget.removeEventListener('statechange', onStateChange);
      widget.remove();
    });
  });

  return <div ref={(el) => (host = el)} class="flex justify-center" />;
};
