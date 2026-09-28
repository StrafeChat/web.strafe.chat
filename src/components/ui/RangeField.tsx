import type { Component } from 'solid-js';
import { createUniqueId, Show } from 'solid-js';
import { fieldLabelClass } from './Input';

interface RangeFieldProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  /** Text shown at the end of the label row (e.g. "80%"). */
  valueLabel?: string;
  onChange: (next: number) => void;
  class?: string;
  'aria-label'?: string;
}

/** Native range input dressed to match the other fields, with the current value alongside. */
export const RangeField: Component<RangeFieldProps> = (props) => {
  const id = createUniqueId();
  return (
    <div class={`w-full space-y-1.5 ${props.class ?? ''}`}>
      <Show when={props.label || props.valueLabel}>
        <div class="flex items-center justify-between gap-3">
          <Show when={props.label}>
            <label for={id} class={fieldLabelClass}>
              {props.label}
            </label>
          </Show>
          <Show when={props.valueLabel}>
            <span class="text-xs tabular-nums text-muted-foreground">{props.valueLabel}</span>
          </Show>
        </div>
      </Show>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        disabled={props.disabled}
        aria-label={props['aria-label'] ?? props.label}
        onInput={(e) => props.onChange(Number(e.currentTarget.value))}
        class="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
};
