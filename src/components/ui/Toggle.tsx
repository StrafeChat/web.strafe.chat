import type { Component } from 'solid-js';

/** Shared on/off switch — rect track (not a pill), matching Strafe's radius scale. */
export const Toggle: Component<{
  checked: boolean;
  disabled?: boolean;
  label?: string;
  onChange: (next: boolean) => void;
}> = (props) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      disabled={props.disabled}
      class={`relative h-6 w-11 shrink-0 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        props.checked ? 'border-primary bg-primary' : 'border-input bg-muted'
      } ${props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      onClick={() => {
        if (!props.disabled) props.onChange(!props.checked);
      }}
    >
      <span
        class={`pointer-events-none absolute top-0.5 block size-5 rounded-sm bg-white shadow transition-transform ${
          props.checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
};
