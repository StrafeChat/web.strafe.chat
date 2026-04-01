/**
 * Shared surfaces aligned with auth (login/register) glass cards:
 * bg-card/70 backdrop-blur-xl border border-border shadow-2xl shadow-black/50
 */

export const appShellCanvas = 'bg-background text-foreground';

/** Narrow server / home rail (~72px) */
export const appSpaceRail =
  'bg-card/55 backdrop-blur-xl border-r border-border shadow-[inset_-1px_0_0_0_hsl(0_0%_100%/0.05)]';

/** DM list, space channel list (~240px) */
export const appChannelRail = 'bg-card/45 backdrop-blur-xl border-r border-border';

/** Right activity column */
export const appActivityRail = 'bg-card/45 backdrop-blur-xl border-l border-border';

/** Sticky title row (Home, room header, sidebar h-12) */
export const appHeaderBar = 'bg-card/35 backdrop-blur-md border-b border-border';

/** In-content strips (search, sub-toolbars) */
export const appContentBand = 'bg-card/35 backdrop-blur-md border-b border-border/80';

/** Modal overlays */
export const appModalBackdrop = 'bg-black/60 backdrop-blur-sm';

/** Large modals (settings) */
export const appModalPanel =
  'rounded-3xl border border-border bg-card/85 backdrop-blur-xl shadow-2xl shadow-black/50';

/** Standard dialogs (create space, confirm, etc.) */
export const appDialogPanel =
  'rounded-2xl border border-border bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/45';

/**
 * Bottom sheet on small screens, centered dialog from md+.
 * Compose with a z-index utility (e.g. `z-50`) on the same element.
 */
export const appResponsiveDialogOverlay = `${appModalBackdrop} fixed inset-0 flex items-end justify-center p-0 md:items-center md:justify-center md:p-4`;

const appResponsiveDialogGlass =
  'border-border bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/45';

/** Narrow dialogs (add friend, rename group, …). Bottom padding lives here so content uses px-6 pt-6 without overriding pb. */
export const appResponsiveDialogPanelSm =
  'w-full max-w-full min-h-0 max-h-[min(92dvh,42rem)] overflow-y-auto overscroll-contain rounded-t-3xl border-x border-t border-border border-b-0 pb-[max(1.75rem,calc(env(safe-area-inset-bottom)+1.25rem))] md:max-h-[85vh] md:max-w-sm md:rounded-2xl md:border md:border-border md:pb-8 ' +
  appResponsiveDialogGlass;

/** Wide dialogs (external link, create space, invite, …) */
export const appResponsiveDialogPanelMd =
  'w-full max-w-full min-h-0 max-h-[min(92dvh,42rem)] overflow-y-auto overscroll-contain rounded-t-3xl border-x border-t border-border border-b-0 pb-[max(1.75rem,calc(env(safe-area-inset-bottom)+1.25rem))] md:max-h-[85vh] md:max-w-md md:rounded-2xl md:border md:border-border md:pb-8 ' +
  appResponsiveDialogGlass;

/** Context menu, small floating panels */
export const appMenuPopover =
  'rounded-xl border border-border bg-popover/95 backdrop-blur-xl shadow-2xl shadow-black/40';

/** Bottom dock in sidebars (user area) */
export const appUserDock = 'bg-card/50 backdrop-blur-md border-t border-border';

/** Settings modal sidebar */
export const appSettingsSidebar = 'border-r border-border bg-background/65 backdrop-blur-md';

/** Floating toolbars / compact panels */
export const appFloatPanel =
  'rounded-xl border border-border bg-card/90 backdrop-blur-md shadow-lg shadow-black/30';
