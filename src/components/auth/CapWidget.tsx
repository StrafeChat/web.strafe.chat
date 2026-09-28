import type { Component } from 'solid-js';
import { onCleanup, onMount } from 'solid-js';
import '@cap.js/widget';
import type { CapErrorEvent, CapSolveEvent, CapWidget as CapWidgetElement } from '@cap.js/widget';
import { t } from '../../i18n';
import type { CaptchaWidgetProps } from './CaptchaWidget';

/**
 * Cap (https://trycap.dev): a self-hosted proof-of-work challenge, like ALTCHA, except
 * that it runs as its own service rather than inside the API. The browser therefore talks
 * to the Cap instance directly - `apiUrl` is where, and it comes from this instance's
 * `GET /` rather than being baked in, so every deployment points at its own Cap.
 *
 * The widget script is bundled from npm rather than loaded from a CDN, so registering
 * still contacts nothing but this instance's own infrastructure.
 *
 * Built imperatively for the same reason as the ALTCHA one: it is a custom element whose
 * attributes have to be in place before `customElements` upgrades it.
 */
export const CapWidget: Component<CaptchaWidgetProps> = (props) => {
  let host: HTMLDivElement | undefined;

  onMount(() => {
    if (!host) return;
    const apiUrl = (props.apiUrl ?? '').replace(/\/+$/, '');
    const siteKey = (props.siteKey ?? '').replace(/^\/+|\/+$/g, '');
    if (!apiUrl || !siteKey) {
      // Nothing to point the widget at: say so rather than render a box that can never
      // solve, which would leave the submit button disabled with no explanation.
      props.onLoadError?.();
      return;
    }

    const widget = document.createElement('cap-widget') as CapWidgetElement;
    // Cap addresses one site as <instance>/<site key>/ - the trailing slash matters.
    widget.setAttribute('data-cap-api-endpoint', `${apiUrl}/${siteKey}/`);
    // The token is read from the solve event into the JSON request body; the hidden input
    // Cap adds for classic form posts is unused here but harmless.
    widget.setAttribute('data-cap-i18n-initial-state', t('auth.captcha.cap.initial'));
    widget.setAttribute('data-cap-i18n-verifying-label', t('auth.captcha.cap.verifying'));
    widget.setAttribute('data-cap-i18n-solved-label', t('auth.captcha.cap.solved'));
    widget.setAttribute('data-cap-i18n-error-label', t('auth.captcha.cap.error'));
    widget.setAttribute('data-cap-i18n-verify-aria-label', t('auth.captcha.cap.initial'));
    widget.setAttribute('data-cap-i18n-verifying-aria-label', t('auth.captcha.cap.verifying'));
    widget.setAttribute('data-cap-i18n-verified-aria-label', t('auth.captcha.cap.solved'));
    widget.setAttribute('data-cap-i18n-error-aria-label', t('auth.captcha.cap.error'));
    widget.setAttribute('data-cap-i18n-wasm-disabled', t('auth.captcha.cap.wasmDisabled'));

    const onSolve = (ev: Event) => props.onToken((ev as CapSolveEvent).detail?.token ?? '');
    // A solved token that has been spent or has expired is refused server-side anyway;
    // clearing it here keeps the form's own view of "ready to submit" honest.
    const onReset = () => props.onToken('');
    const onError = (ev: Event) => {
      const detail = (ev as CapErrorEvent).detail;
      props.onToken('');
      // Anything that means the challenge can never be solved here (the instance is
      // unreachable, WASM is blocked) is a load failure the form should explain;
      // a failed attempt is just a reset.
      const fatal = detail?.code === 'network_error' || detail?.code === 'missing_endpoint' || detail?.code === 'wasm_load_failed' || detail?.code === 'worker_spawn_failed';
      if (fatal) {
        console.warn('[captcha] Cap could not run', detail?.code, detail?.message);
        props.onLoadError?.();
      }
    };

    widget.addEventListener('solve', onSolve);
    widget.addEventListener('reset', onReset);
    widget.addEventListener('error', onError);
    host.appendChild(widget);

    props.onReady?.(() => {
      props.onToken('');
      widget.reset();
    });

    onCleanup(() => {
      widget.removeEventListener('solve', onSolve);
      widget.removeEventListener('reset', onReset);
      widget.removeEventListener('error', onError);
      widget.remove();
    });
  });

  return <div ref={(el) => (host = el)} class="flex justify-center" />;
};
