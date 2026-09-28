/**
 * Shared building blocks for settings pages (user, space, room) so every page lays out
 * its sections, rows and row icons the same way.
 */

/** Small caps section heading above a group of rows. */
export const settingsSectionTitle = 'px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground';

/** One setting row: icon, title + description, control on the end. */
export const settingsRowShell =
  'flex items-center gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3.5 transition-colors hover:bg-muted/30';

/** Icon tile at the start of a settings row. */
export const settingsRowIcon = 'flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground';

/** Framed group used for grouped controls (upload forms, notes). */
export const settingsGroupFrame = 'rounded-xl border border-border bg-muted/20 p-4';
