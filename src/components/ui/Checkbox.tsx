import type { Component, JSX } from 'solid-js';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Primary text next to the box. */
  label?: JSX.Element;
  /** Secondary line under the label. */
  description?: JSX.Element;
  class?: string;
  /** Visually hide the label (still announced). */
  srOnlyLabel?: boolean;
}

/**
 * Brand-tinted checkbox. The native control is kept (keyboard, a11y, form semantics) and
 * recolored via accent-color so it no longer renders in the browser's default blue.
 */
export const Checkbox: Component<CheckboxProps> = (props) => (
  <label
    class={`flex cursor-pointer items-start gap-2.5 ${props.disabled ? 'cursor-not-allowed opacity-60' : ''} ${props.class ?? ''}`}
  >
    <input
      type="checkbox"
      checked={props.checked}
      disabled={props.disabled}
      onChange={(e) => props.onChange(e.currentTarget.checked)}
      class="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed"
    />
    {props.label ? (
      <span class={`min-w-0 ${props.srOnlyLabel ? 'sr-only' : ''}`}>
        <span class="block text-sm leading-snug text-foreground">{props.label}</span>
        {props.description ? (
          <span class="mt-0.5 block text-xs leading-snug text-muted-foreground">{props.description}</span>
        ) : null}
      </span>
    ) : null}
  </label>
);
