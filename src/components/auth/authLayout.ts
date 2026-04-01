/** Shared layout for Login / Register so card width, padding, and rhythm match */

export const authPageOuter =
  'relative isolate z-10 flex min-h-dvh flex-col text-foreground max-sm:justify-start max-sm:px-4 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] max-sm:pt-[4.25rem] sm:items-center sm:justify-center sm:p-6 sm:pt-8 lg:p-8';

/** Single max width on sm+; full width on mobile (no card chrome) */
export const authCardShell = 'flex w-full max-w-full flex-1 flex-col sm:max-w-md sm:flex-none';

/** Glass card on sm+ only; flat full-page on mobile */
export const authCardClass =
  'w-full max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none max-sm:backdrop-blur-none rounded-3xl border border-border bg-card/70 shadow-2xl shadow-black/50 backdrop-blur-xl';

export const authCardHeaderClass = 'text-start space-y-0 max-sm:p-0 max-sm:pb-3 sm:space-y-1.5';

/** Same vertical spacing between fields on every step */
export const authCardContentClass = 'space-y-5 pt-2 max-sm:p-0 max-sm:pt-0';

export const authCardFooterClass =
  'flex w-full flex-col items-stretch gap-3 pt-2 max-sm:p-0 max-sm:pt-6';
