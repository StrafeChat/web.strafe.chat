import type { Component } from 'solid-js';
import { onCleanup, onMount } from 'solid-js';
import { FriendlyCaptchaSDK, type WidgetHandle } from '@friendlycaptcha/sdk';
import type { CaptchaWidgetProps } from './CaptchaWidget';

/**
 * Friendly Captcha v2. The SDK is bundled with the client, so unlike Turnstile no
 * third-party script runs in the page: the widget fetches a proof-of-work puzzle from the
 * Friendly Captcha API, solves it locally, and hands back a response the server verifies.
 */
export const FriendlyCaptchaWidget: Component<CaptchaWidgetProps> = (props) => {
  let host: HTMLDivElement | undefined;
  let widget: WidgetHandle | null = null;

  onMount(() => {
    if (!host) return;
    let sdk: FriendlyCaptchaSDK;
    try {
      sdk = new FriendlyCaptchaSDK();
      widget = sdk.createWidget({
        element: host,
        sitekey: props.siteKey,
        // No hidden form field: the response goes through onToken into the JSON body.
        formFieldName: null,
        // Start solving when the user reaches the form rather than on page load, which
        // keeps the puzzle from expiring while they are still typing.
        startMode: 'focus',
      });
    } catch (e) {
      console.warn('[captcha] friendly captcha failed to initialise', e);
      props.onLoadError?.();
      return;
    }

    const onComplete = (ev: Event) => props.onToken((ev as CustomEvent<{ response: string }>).detail.response);
    // Both clear the token: a stale one is refused server-side anyway, and letting the
    // form think it still has a valid answer just produces a confusing 403.
    const onExpire = () => props.onToken('');
    const onError = () => props.onToken('');
    host.addEventListener('frc:widget.complete', onComplete);
    host.addEventListener('frc:widget.expire', onExpire);
    host.addEventListener('frc:widget.error', onError);

    props.onReady?.(() => {
      props.onToken('');
      widget?.reset();
    });

    onCleanup(() => {
      host?.removeEventListener('frc:widget.complete', onComplete);
      host?.removeEventListener('frc:widget.expire', onExpire);
      host?.removeEventListener('frc:widget.error', onError);
      widget?.destroy();
      widget = null;
    });
  });

  return <div ref={(el) => (host = el)} class="flex justify-center" />;
};
