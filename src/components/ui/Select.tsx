import type { Component, JSX } from 'solid-js';
import { children, createEffect, createUniqueId, splitProps } from 'solid-js';
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
  // Resolve children through `children()` so this component actually tracks when the <option>
  // set changes. The `value` property is applied before the options exist (and whenever the
  // list is rebuilt - e.g. device selects whose options arrive asynchronously after
  // enumerateDevices resolves), so a value other than the first option would otherwise be lost
  // on mount and never re-applied. A bare `void local.children` did NOT work: a <For> reads its
  // source signal in its own scope, so the effect never re-ran when the options loaded, and the
  // select silently fell back to its first option (e.g. a saved mic/speaker reverting to
  // "Default" every time you re-opened Voice & Video). Depending on the resolved children makes
  // the effect re-assert `value` the moment the real options appear.
  const resolved = children(() => local.children);
  createEffect(() => {
    const v = local.value;
    resolved();
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
          {resolved()}
        </select>
        <i
          class="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  );
};
