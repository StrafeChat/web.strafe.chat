import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';

interface IconButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Full Font Awesome class, e.g. `fa-solid fa-gear`. */
  icon: string;
  /** Accessible name; also used as the hover title unless `title` is given. */
  label: string;
  size?: 'sm' | 'md' | 'lg';
  /** Toggle state (renders pressed + aria-pressed). */
  active?: boolean;
  /**
   * `default` - muted icon, accent hover (toolbar buttons).
   * `subtle` - dimmer idle state for secondary actions that shouldn't compete.
   * `danger` - red on hover (destructive one-offs).
   * `overlay` - dark circle for use over imagery (profile banners).
   */
  tone?: 'default' | 'subtle' | 'danger' | 'overlay';
  class?: string;
}

const sizeStyles: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'size-7 rounded-md text-[11px]',
  md: 'size-8 rounded-md text-sm',
  lg: 'size-9 rounded-lg text-base',
};

const toneStyles: Record<NonNullable<IconButtonProps['tone']>, string> = {
  default: 'text-muted-foreground hover:bg-accent hover:text-foreground',
  subtle: 'text-muted-foreground/60 hover:bg-accent hover:text-foreground',
  danger: 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
  overlay: 'rounded-full bg-black/45 text-white/90 backdrop-blur hover:bg-black/65 hover:text-white',
};

const activeStyle = 'bg-accent text-accent-foreground';

/**
 * Square icon-only button. Every toolbar / header / row action in the app uses this so
 * they share one radius, hover fill and focus ring.
 */
export const IconButton: Component<IconButtonProps> = (props) => {
  const [local, rest] = splitProps(props, ['icon', 'label', 'size', 'active', 'tone', 'class', 'title']);
  const size = () => local.size ?? 'md';
  const tone = () => local.tone ?? 'default';
  return (
    <button
      type="button"
      aria-label={local.label}
      title={local.title ?? local.label}
      {...(local.active !== undefined ? { 'aria-pressed': local.active } : {})}
      class={`inline-flex shrink-0 cursor-pointer items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${sizeStyles[size()]} ${
        local.active ? activeStyle : toneStyles[tone()]
      } ${local.class ?? ''}`}
      {...rest}
    >
      <i class={local.icon} aria-hidden="true" />
    </button>
  );
};
