/** Shared layout for Login / Register so card width, padding, and rhythm match */

export const authPageOuter =
  'relative isolate z-10 flex min-h-dvh flex-col text-foreground max-sm:justify-start max-sm:px-4 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] max-sm:pt-[4.25rem] sm:items-center sm:justify-center sm:p-6 sm:pt-8 lg:p-8';

/** Single max width on sm+; full width on mobile (no card chrome) */
export const authCardShell = 'flex w-full max-w-full flex-1 flex-col sm:max-w-md sm:flex-none';

/**
 * Core glass surface — same recipe as login/register cards.
 * Use for modals, elevated panels, and (with different rounding) app chrome.
 */
export const authGlassSurface =
  'rounded-3xl border border-border bg-card/70 shadow-2xl shadow-black/50 backdrop-blur-xl';

/** Tint + blur without border — sidebars, headers, docks (add borders per layout). */
export const authGlassTint = 'bg-card/70 backdrop-blur-xl';

/** Glass card on sm+ only; flat full-page on mobile */
export const authCardClass = `w-full ${authGlassSurface} max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none max-sm:backdrop-blur-none`;

export const authCardHeaderClass = 'text-start space-y-0 max-sm:p-0 max-sm:pb-3 sm:space-y-1.5';

/** Same vertical spacing between fields on every step */
export const authCardContentClass = 'space-y-5 pt-2 max-sm:p-0 max-sm:pt-0';

export const authCardFooterClass =
  'flex w-full flex-col items-stretch gap-3 pt-2 max-sm:p-0 max-sm:pt-6';

/** The small text link under an auth card's main button ("Need an account?", "Forgot your
 * password?"). */
export const authFooterLinkClass =
  'text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 text-start rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0';

/** A link styled as the card's primary button, for the "go to sign in" step after an
 * action that ends on this page (an email verified, a password reset). */
export const authPrimaryLinkClass =
  'inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0';
