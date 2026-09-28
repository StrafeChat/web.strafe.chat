import type { Component } from 'solid-js';
import { Match, Switch } from 'solid-js';
import { TurnstileWidget } from './TurnstileWidget';
import { FriendlyCaptchaWidget } from './FriendlyCaptchaWidget';
import { AltchaWidget } from './AltchaWidget';
import { CapWidget } from './CapWidget';

/**
 * Props every provider's widget accepts. The register form talks only to this shape, so
 * which challenge an instance runs is the instance's business, not the form's.
 */
export interface CaptchaWidgetProps {
  /** Public site key for hosted providers and Cap; unused by ALTCHA. */
  siteKey: string;
  /** Where the browser reaches the challenge service, for providers that run as their
   * own service (Cap). Empty for every other provider. */
  apiUrl?: string;
  /** Called with a token when the challenge is solved, and with '' when it expires or errors. */
  onToken: (token: string) => void;
  /** Receives a reset function so the form can re-arm the widget after a failed submit. */
  onReady?: (reset: () => void) => void;
  /** Surface a load failure to the form, which should then explain rather than hang. */
  onLoadError?: () => void;
}

/**
 * Renders whichever registration challenge this instance is configured for (see the
 * `features.captcha.provider` field of GET /). Unknown providers report a load error, so a
 * client older than its server degrades to a clear message instead of a form that can
 * never be submitted.
 */
export const CaptchaWidget: Component<CaptchaWidgetProps & { provider: string }> = (props) => (
  <Switch fallback={<UnknownProvider onLoadError={props.onLoadError} />}>
    <Match when={props.provider === 'turnstile'}>
      <TurnstileWidget siteKey={props.siteKey} onToken={props.onToken} onReady={props.onReady} onLoadError={props.onLoadError} />
    </Match>
    <Match when={props.provider === 'friendly'}>
      <FriendlyCaptchaWidget siteKey={props.siteKey} onToken={props.onToken} onReady={props.onReady} onLoadError={props.onLoadError} />
    </Match>
    <Match when={props.provider === 'altcha'}>
      <AltchaWidget siteKey={props.siteKey} onToken={props.onToken} onReady={props.onReady} onLoadError={props.onLoadError} />
    </Match>
    <Match when={props.provider === 'cap'}>
      <CapWidget siteKey={props.siteKey} apiUrl={props.apiUrl} onToken={props.onToken} onReady={props.onReady} onLoadError={props.onLoadError} />
    </Match>
  </Switch>
);

const UnknownProvider: Component<{ onLoadError?: () => void }> = (props) => {
  props.onLoadError?.();
  return null;
};
