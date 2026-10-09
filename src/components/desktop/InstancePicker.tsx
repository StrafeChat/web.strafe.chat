import type { Component } from 'solid-js';
import { createEffect, createSignal, on, onCleanup, onMount, Show } from 'solid-js';
import { fieldLabelClass, inputBaseClass, inputErrorClass } from '../ui/Input';
import { InstanceResolveError, resolveInstance, type InstanceResolveCode, type ResolvedInstance } from '../../desktop/instance';
import { setDesktopInstance } from '../../desktop/instanceOverride';
import { desktopAccountsLoaded, lastDesktopInstance } from '../../desktop/accounts';
import { loadInstanceInfo, resetInstanceInfo } from '../../stores/instance';
import { t } from '../../i18n';

type Status = 'idle' | 'resolving' | 'ok' | 'error';

const DEBOUNCE_MS = 700;

/**
 * The first field of the sign-in and sign-up forms in the desktop app: which instance.
 * A browser knows (it was served by one); the app has to ask. The address is looked up
 * as you type (debounced), and the form stays disabled until an instance has answered,
 * so a typo cannot send a password to the wrong place.
 */
export const InstancePicker: Component<{ disabled?: boolean; onReady: (ready: boolean) => void }> = (props) => {
  const initial = lastDesktopInstance();
  const [value, setValue] = createSignal(initial?.domain ?? '');
  const [status, setStatus] = createSignal<Status>(initial ? 'ok' : 'idle');
  const [resolved, setResolved] = createSignal<ResolvedInstance | null>(initial);
  const [errorCode, setErrorCode] = createSignal<InstanceResolveCode>('unreachable');
  let timer: number | undefined;
  let inflight: AbortController | undefined;

  onMount(() => props.onReady(status() === 'ok'));

  // The account file is read after the page is up. Once it is, an empty field takes the
  // instance of the most recent account - the way a browser is already "on" its instance -
  // so a cold start lands with the right one chosen and the form ready.
  createEffect(
    on(desktopAccountsLoaded, (loaded) => {
      if (!loaded || value().trim() || status() !== 'idle') return;
      const inst = lastDesktopInstance();
      if (!inst) return;
      setValue(inst.domain);
      setResolved(inst);
      setStatus('ok');
      setDesktopInstance({ domain: inst.domain, apiUrl: inst.apiUrl, stargateUrl: inst.stargateUrl });
      resetInstanceInfo();
      void loadInstanceInfo();
      props.onReady(true);
    }),
  );

  onCleanup(() => {
    inflight?.abort();
    if (timer) window.clearTimeout(timer);
  });

  async function resolveNow() {
    if (timer) window.clearTimeout(timer);
    inflight?.abort();
    const raw = value().trim();
    if (!raw) {
      setStatus('idle');
      setResolved(null);
      props.onReady(false);
      return;
    }
    const mine = new AbortController();
    inflight = mine;
    setStatus('resolving');
    props.onReady(false);
    try {
      const inst = await resolveInstance(raw, mine.signal);
      if (mine.signal.aborted) return;
      setResolved(inst);
      setStatus('ok');
      setDesktopInstance({ domain: inst.domain, apiUrl: inst.apiUrl, stargateUrl: inst.stargateUrl });
      // The captcha, invite and email settings the forms adapt to belong to this instance.
      resetInstanceInfo();
      void loadInstanceInfo();
      props.onReady(true);
    } catch (e) {
      if (mine.signal.aborted) return;
      setErrorCode(e instanceof InstanceResolveError ? e.code : 'unreachable');
      setStatus('error');
    }
  }

  function onInput(next: string) {
    setValue(next);
    setStatus('idle');
    props.onReady(false);
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => void resolveNow(), DEBOUNCE_MS);
  }

  const host = () => value().trim().replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '');
  const message = () => {
    switch (status()) {
      case 'resolving':
        return t('desktop.instance.resolving', { host: host() });
      case 'ok': {
        const r = resolved();
        return r?.version
          ? t('desktop.instance.connectedVersion', { host: r.domain, version: r.version })
          : t('desktop.instance.connected', { host: r?.domain ?? host() });
      }
      case 'error':
        return errorCode() === 'invalid'
          ? t('desktop.instance.errorInvalid')
          : errorCode() === 'not_strafe'
            ? t('desktop.instance.errorNotStrafe', { host: host() })
            : t('desktop.instance.errorUnreachable', { host: host() });
      default:
        return t('desktop.instance.hint');
    }
  };

  return (
    <div class="w-full space-y-1.5">
      <label for="desktop-instance-input" class={fieldLabelClass}>
        {t('desktop.instance.label')}
      </label>
      <div class="relative">
        <i
          class="fa-solid fa-globe pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="desktop-instance-input"
          type="text"
          inputmode="url"
          autocomplete="off"
          autocapitalize="none"
          spellcheck={false}
          dir="ltr"
          class={`${inputBaseClass} h-10 min-h-10 ps-9 pe-9 py-2 ${status() === 'error' ? inputErrorClass : ''}`}
          placeholder={t('desktop.instance.placeholder')}
          value={value()}
          disabled={props.disabled}
          onInput={(e) => onInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void resolveNow();
            }
          }}
          onBlur={() => {
            if (status() === 'idle' && value().trim()) void resolveNow();
          }}
        />
        <span class="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm" aria-hidden="true">
          <Show when={status() === 'resolving'}>
            <i class="fa-solid fa-arrows-rotate animate-spin text-muted-foreground" />
          </Show>
          <Show when={status() === 'ok'}>
            <i class="fa-solid fa-circle-check text-primary" />
          </Show>
          <Show when={status() === 'error'}>
            <i class="fa-solid fa-circle-exclamation text-destructive" />
          </Show>
        </span>
      </div>
      <p class={`text-xs ${status() === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} role={status() === 'error' ? 'alert' : 'status'}>
        {message()}
      </p>
    </div>
  );
};
