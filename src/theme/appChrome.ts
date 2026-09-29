/**
 * App chrome — same glass language as auth (login/register):
 * authGlassTint on rails, authGlassSurface on elevated panels.
 */

import { authGlassSurface, authGlassTint } from '../components/auth/authLayout';

/** Main shell: transparent so the fixed AppBackground layer shows through */
export const appShellCanvas = 'relative z-10 min-h-0 bg-transparent text-foreground';

/** Narrow server / home rail (~72px) */
export const appSpaceRail = `${authGlassTint} border-r border-border shadow-[inset_-1px_0_0_0_hsl(0_0%_100%/0.06)]`;

/** DM list, space channel list (~240px) */
export const appChannelRail = `${authGlassTint} border-r border-border`;

/** Right activity column */
export const appActivityRail = `${authGlassTint} border-l border-border`;

/** Sticky title row (Home, room header, sidebar h-12) */
export const appHeaderBar = `${authGlassTint} border-b border-border`;

/** The h-12 title row at the top of every page / column. Add `gap-*` / `justify-*` as needed. */
export const appPageHeader = `flex h-12 shrink-0 items-center px-4 ${appHeaderBar}`;
/** The h1 inside appPageHeader. */
export const appPageTitle = 'text-base font-semibold text-foreground';

/** In-content strips (search, sub-toolbars) */
export const appContentBand = `${authGlassTint} border-b border-border/80`;

/**
 * Stacking tiers. Every fixed / portaled layer picks one of these so nesting stays
 * predictable: a dialog raised from inside a modal lands on a higher tier than the modal,
 * and popovers (menus, tooltips) sit above every modal because they open from inside them.
 */
export const zLayer = {
  /** In-page drawers (mobile members panel, channel drawer). */
  drawer: 'z-40',
  /** Settings shells and standard dialogs opened from the page. */
  modal: 'z-[200]',
  /** Dialogs opened from inside another modal (theme editor, safety number, external link). */
  modalStacked: 'z-[220]',
  /** Confirm prompts - may be raised from any modal or stacked dialog. */
  confirm: 'z-[240]',
  /** Attachment lightbox. */
  lightbox: 'z-[260]',
  /** Context menus, tooltips, popovers, dropdowns. */
  popover: 'z-[300]',
  /** Recovery PIN / environment errors - above everything. */
  critical: 'z-[400]',
} as const;

/** Modal overlays */
export const appModalBackdrop = 'bg-black/60 backdrop-blur-sm';

/** Large modals (settings) — full auth glass */
export const appModalPanel = authGlassSurface;

/** Standard dialogs (create space, confirm, etc.) */
export const appDialogPanel = authGlassSurface;

/**
 * Bottom sheet on small screens, centered dialog from md+.
 * Compose with a `zLayer` tier on the same element.
 */
export const appResponsiveDialogOverlay = `${appModalBackdrop} fixed inset-0 flex items-end justify-center p-0 md:items-center md:justify-center md:p-4`;

const appResponsiveDialogGlass =
  'border border-border bg-card/70 backdrop-blur-xl shadow-2xl shadow-black/50';

/** Panel shell of every ResponsiveDialog: sheet on phones, centered rounded card from md+. Width comes from `appResponsiveDialogWidth`. */
export const appResponsiveDialogPanel =
  'relative flex w-full max-w-full min-h-0 max-h-[min(92dvh,42rem)] flex-col overflow-hidden rounded-t-3xl border-x border-t border-border border-b-0 md:max-h-[85vh] md:rounded-3xl md:border md:border-border ' +
  appResponsiveDialogGlass;

export const appResponsiveDialogWidth = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-md',
  lg: 'md:max-w-lg',
} as const;

/** Inner padding of a padded dialog body. The bottom clears the home indicator on phones. */
export const appResponsiveDialogPadding =
  'px-6 pt-5 pb-[max(1.75rem,calc(env(safe-area-inset-bottom)+1.25rem))] md:pt-6 md:pb-7';

/** Card-style popovers (user area card, profile card) */
export const appMenuPopover =
  'rounded-3xl border border-border bg-popover/90 backdrop-blur-xl shadow-2xl shadow-black/40';

/**
 * List menus (context menu, header dropdowns, @mention autocomplete). Padded so the
 * rounded item rows nest inside the panel corners instead of clipping against them.
 */
export const appMenuPanel =
  'rounded-2xl border border-border bg-popover/90 p-1.5 backdrop-blur-xl shadow-2xl shadow-black/40';

/** One row inside appMenuPanel. Compose with a tone below. */
export const appMenuItem =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors';
export const appMenuItemDefault = `${appMenuItem} text-foreground hover:bg-accent/70`;
export const appMenuItemDanger = `${appMenuItem} text-destructive hover:bg-destructive/10`;
export const appMenuItemDisabled = `${appMenuItem} cursor-not-allowed text-muted-foreground/50`;
export const appMenuSeparator = 'my-1 border-t border-border/60';

/** Small uppercase group label: sidebar sections, member buckets, settings sections. */
export const appSectionLabel = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';

/** Interactive list rows (sidebar nav, conversations, members). Compose with a state below.
 * Vertical padding is driven by the UI-density appearance setting (--density-row-py). */
export const appListRow =
  'flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-[var(--density-row-py)] text-start transition-colors';
export const appListRowIdle = 'text-foreground hover:bg-accent hover:text-accent-foreground';
export const appListRowActive = 'bg-primary/15 text-foreground ring-1 ring-inset ring-primary/20';

/** Compact rows (channel list, section headers) - a little tighter than appListRow.
 * Vertical padding is driven by the UI-density appearance setting (--density-compact-py). */
export const appCompactRow =
  'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-[var(--density-compact-py)] text-start text-sm transition-colors';
export const appCompactRowIdle = 'text-muted-foreground hover:bg-accent/50 hover:text-foreground';
export const appCompactRowActive = 'bg-primary/15 text-foreground ring-1 ring-inset ring-primary/20';

/** Dialog footer row: actions right-aligned on every dialog. */
export const appDialogActions = 'flex justify-end gap-2 pt-2';

/** Dialog title / description pair used by every ResponsiveDialog. */
export const appDialogTitle = 'text-lg font-semibold leading-snug text-foreground';
export const appDialogDescription = 'text-sm text-muted-foreground';

/** Icon chip beside a dialog title. Compose with a tone below. */
export const appDialogIconChip = 'flex shrink-0 items-center justify-center rounded-full';
export const appDialogIconTone = {
  default: 'bg-primary/15 text-primary',
  warning: 'bg-amber-500/15 text-amber-500',
  danger: 'bg-destructive/15 text-destructive',
} as const;

/** Data tables (members, invites, bans). Wrap in `appTableFrame` so wide tables scroll. */
export const appTableFrame = 'overflow-x-auto rounded-xl border border-border/70 bg-card/10';
export const appTable = 'w-full min-w-[40rem] border-separate border-spacing-0 text-sm';
export const appTableHeadCell =
  'sticky top-0 z-[1] border-b border-border/70 bg-card/80 px-3 py-2 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur';
export const appTableCell = 'border-b border-border/50 px-3 py-2.5 align-middle';
export const appTableRow = 'transition-colors hover:bg-muted/20';

/** Empty-state block (no friends, no results, no pins…): dashed frame, centered copy. */
export const appEmptyState =
  'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center';
export const appEmptyStateIcon = 'text-2xl text-muted-foreground/60';
export const appEmptyStateTitle = 'text-sm font-medium text-foreground';
export const appEmptyStateBody = 'text-xs text-muted-foreground';

/** Bottom dock in sidebars (user area) */
export const appUserDock = `${authGlassTint} border-t border-border`;

/** Settings modal sidebar (borders are applied per-breakpoint by SettingsNav) */
export const appSettingsSidebar = authGlassTint;

/** Floating compact panels (pinned messages) */
export const appFloatPanel =
  'rounded-3xl border border-border bg-card/70 backdrop-blur-xl shadow-lg shadow-black/30';

/** Small hover toolbars (message actions) - tighter radius so icon buttons nest cleanly. */
export const appFloatToolbar =
  'rounded-xl border border-border bg-card/85 backdrop-blur-xl shadow-lg shadow-black/30';

/**
 * The composer floats over the end of the message list instead of sitting below it, so
 * scrolling back through a conversation shows messages sliding under a frosted bar.
 *
 * Height is not fixed (the box grows with the draft, attachments and the reply strip), so
 * the dock reports its measured height as `--composer-height` and the list pads itself by
 * that much - see RoomComposerDock.
 */
export const appComposerDock = 'absolute inset-x-0 bottom-0 z-20';
/** Short gradient above the bar so content dissolves into it rather than meeting an edge. */
export const appComposerDockFade = 'pointer-events-none h-4 w-full bg-gradient-to-b from-transparent to-card/55';
/**
 * Lighter than the usual glass tint (`authGlassTint`) on purpose: at 70% opacity the
 * messages passing underneath were only a smudge, and the whole point of floating the
 * composer is that you can still see them. The composer's own input keeps its solid
 * background, so nothing you are typing loses contrast.
 */
export const appComposerDockSurface = 'bg-card/55 backdrop-blur-md';
