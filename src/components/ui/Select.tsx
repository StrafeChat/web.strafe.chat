import type { Component, JSX } from 'solid-js';
import { createEffect, createUniqueId, splitProps } from 'solid-js';
import { fieldLabelClass, inputBaseClass } from './Input';

interface SelectProps extends Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  class?: string;
  children: JSX.Element;
}

/** Native select dressed like Input, with our own chevron instead of the browser's. */
export const Select: Component<SelectProps> = (props) => {
  const uniqueId = createUniqueId();
  const [local, rest] = splitProps(props, ['label', 'value', 'onValueChange', 'class', 'children', 'id']);
  const id = () => local.id ?? uniqueId;
  let el: HTMLSelectElement | undefined;
  // The `value` property is applied before the <option> children exist, so a value other
  // than the first option is lost on mount (and whenever the option list is re-rendered).
  // Re-assert it after render.
  createEffect(() => {
    const v = local.value;
    void local.children;
    if (el && el.value !== v) el.value = v;
  });
  return (
    <div class="w-full space-y-1.5">
      {local.label ? (
        <label for={id()} class={fieldLabelClass}>
          {local.label}
        </label>
      ) : null}
      <div class="relative">
        <select
          ref={(node) => {
            el = node;
          }}
          id={id()}
          value={local.value}
          onChange={(e) => local.onValueChange(e.currentTarget.value)}
          class={`${inputBaseClass} h-10 cursor-pointer appearance-none pl-3 pr-9 ${local.class ?? ''}`}
          {...rest}
        >
          {local.children}
        </select>
        <i
          class="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  );
};
