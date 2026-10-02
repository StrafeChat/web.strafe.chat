import type { Component } from 'solid-js';
import type { ProfileRole } from '../stores/userProfilePopover';
import { spaceRoleColorHex } from '../lib/spacePermissions';

export interface RolePillProps {
  role: ProfileRole;
  /** `sm` for inline next to a name, `md` for a roles list. */
  size?: 'sm' | 'md';
  /** When set, renders a remove button and gives the pill room for it. */
  onRemove?: () => void;
  removeLabel?: string;
  disabled?: boolean;
  class?: string;
}

/**
 * The one role pill, used by every surface that shows a role: the profile header row, the
 * popover's editable chips (with `onRemove`), and the full-profile roles list.
 *
 * A rounded chip with a neutral border and normal-foreground text, and a small dot in the
 * role's colour beside the name. The colour stays on the dot on purpose: a member can hold
 * several roles, so tinting the text made a wall of competing colour next to a display name
 * that is *already* tinted by their highest role. The dot marks which role this is without
 * competing with that.
 *
 * The dot also sidesteps the contrast problem entirely - a dark role colour is unreadable as
 * text on a dark background, but fine as a 8px swatch.
 *
 * A colourless role gets a muted grey dot, so "no colour set" is a visible state rather than
 * looking like every other role.
 */
export const RolePill: Component<RolePillProps> = (props) => {
  const dot = () =>
    props.role.color ? spaceRoleColorHex(props.role.color) : 'color-mix(in srgb, var(--color-muted-foreground) 45%, transparent)';

  // Gap and size are decided once, here: setting them in two places emitted `gap-1.5` and
  // `gap-1` on the same chip for the removable variant, and which one wins is stylesheet
  // order rather than class order.
  const geometry = () => {
    const sm = props.size === 'sm';
    const sizeCls = sm
      ? 'px-2 py-px text-[11px] leading-4'
      : 'px-2.5 py-0.5 text-xs leading-[18px]';
    const gap = props.onRemove ? 'gap-1' : sm ? 'gap-1' : 'gap-1.5';
    const pe = props.onRemove ? 'pe-1' : '';
    return `${sizeCls} ${gap} ${pe}`;
  };

  const base = () =>
    `inline-flex max-w-full items-center rounded-full border border-border/70 bg-background/40 font-medium text-foreground ${geometry()} ${props.class ?? ''}`;

  const swatch = () => (
    <span class="size-2 shrink-0 rounded-full" style={{ 'background-color': dot() }} aria-hidden="true" />
  );

  return (
    <span class={base()}>
      {swatch()}
      <span class="min-w-0 truncate">{props.role.name}</span>
      {props.onRemove && (
        <button
          type="button"
          disabled={props.disabled}
          class="flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-30"
          title={props.removeLabel}
          aria-label={props.removeLabel}
          onClick={(e) => {
            e.stopPropagation();
            props.onRemove?.();
          }}
        >
          <i class="fa-solid fa-xmark text-[9px]" aria-hidden="true" />
        </button>
      )}
    </span>
  );
};