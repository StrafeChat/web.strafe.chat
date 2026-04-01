import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';

export interface FormApiErrorsProps {
  messages: string[];
  id?: string;
}

/** Styled list for one or more API / validation error lines (e.g. split "a; b"). */
export const FormApiErrors: Component<FormApiErrorsProps> = (props) => {
  const lines = () => props.messages.filter(Boolean);
  return (
    <Show when={lines().length > 0}>
      <div
        id={props.id}
        class="rounded-lg border border-destructive/45 bg-destructive/10 px-3 py-2.5 shadow-sm"
        role="alert"
        aria-live="polite"
      >
        <ul class="m-0 list-none space-y-2 p-0">
          <For each={lines()}>
            {(line) => (
              <li class="flex gap-2 text-start text-sm leading-snug text-destructive">
                <i
                  class="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-[0.85rem] text-destructive"
                  aria-hidden="true"
                />
                <span>{line}</span>
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
  );
};
