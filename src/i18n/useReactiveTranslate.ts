import { createSignal, onMount, onCleanup } from 'solid-js';
import { useTransContext } from '@mbarzda/solid-i18next';

/** Plain `t` shape (no i18next `$TFunctionBrand`) — works with `translateCaughtApiError` etc. */
export type ReactiveTranslate = (key: string, options?: unknown) => string;

/**
 * Wraps i18next `t` so Solid tracks language changes — plain `t()` from
 * useTransContext does not subscribe to `languageChanged`, so labels/buttons
 * often stayed on the previous locale until something else re-rendered.
 */
export function useReactiveTranslate(): readonly [ReactiveTranslate, ReturnType<typeof useTransContext>[1]] {
  const [t, actions] = useTransContext();
  const [i18nTick, setI18nTick] = createSignal(0);

  onMount(() => {
    const i18n = actions.getI18next();
    const bump = () => setI18nTick((n) => n + 1);
    i18n.on('languageChanged', bump);
    onCleanup(() => i18n.off('languageChanged', bump));
  });

  const tReactive: ReactiveTranslate = (key, options) => {
    i18nTick();
    return options !== undefined ? (t as (k: string, o: unknown) => string)(key, options) : t(key);
  };

  return [tReactive, actions] as const;
}
