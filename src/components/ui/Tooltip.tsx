import type { Component } from 'solid-js';

type Side = 'right' | 'left' | 'top' | 'bottom';

interface TooltipProps {
  label: string;
  children: import('solid-js').JSX.Element;
  /** Preferred side. The host flips to the opposite side when that one doesn't fit. */
  side?: Side;
  /** When true, wrapper does not take full width (e.g. for icon rows). */
  inline?: boolean;
}

/**
 * Hover label. This is a thin wrapper that just tags its trigger with `data-tooltip` (and a
 * preferred side); the single app-wide <TooltipHost> renders and positions the actual bubble,
 * so every tooltip looks identical, none use the native browser bubble, and all of them are
 * automatically disabled on touch devices. See components/ui/TooltipHost.tsx.
 *
 * The side defaults to `right` to match the original component's behaviour.
 */
export const Tooltip: Component<TooltipProps> = (props) => {
  return (
    <div
      data-tooltip={props.label}
      data-tooltip-side={props.side ?? 'right'}
      class={props.inline ? 'inline-flex' : 'w-full flex justify-center'}
    >
      {props.children}
    </div>
  );
};
