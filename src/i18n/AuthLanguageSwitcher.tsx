import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { useTransContext } from '@mbarzda/solid-i18next';
import { I18N_STORAGE_KEY, LOCALES, SUPPORTED_LOCALES, applyDocumentLangDir } from './config';

function localeMeta(code: string) {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

/** Fixed top-end control for auth pages — custom menu for full styling + flags. */
export function AuthLanguageSwitcher() {
  const [t, { changeLanguage, getI18next }] = useTransContext();
  const [lang, setLang] = createSignal('en');
  const [open, setOpen] = createSignal(false);
  let rootEl: HTMLDivElement | undefined;

  onMount(() => {
    const i18n = getI18next();
    const sync = () => setLang(i18n.language);
    sync();
    i18n.on('languageChanged', sync);
    onCleanup(() => i18n.off('languageChanged', sync));

    function onDocPointerDown(e: PointerEvent) {
      if (!open()) return;
      const t = e.target as Node;
      if (rootEl && !rootEl.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onKey);
    onCleanup(() => {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('keydown', onKey);
    });
  });

  async function onSelect(next: string) {
    if (!SUPPORTED_LOCALES.has(next)) return;
    setOpen(false);
    await changeLanguage(next);
    try {
      localStorage.setItem(I18N_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyDocumentLangDir(next);
  }

  const current = () => localeMeta(lang());

  return (
    <div class="pointer-events-auto fixed top-4 end-4 z-[100]" ref={(el) => (rootEl = el)}>
      <span class="sr-only" id="auth-lang-label">
        {t('auth.language')}
      </span>
      <div class="relative">
        <button
          type="button"
          class="group flex min-w-[11.5rem] max-w-[16rem] items-stretch overflow-hidden rounded-2xl border border-border/80 bg-card/85 text-start shadow-lg shadow-black/25 backdrop-blur-md transition-[border-color,box-shadow,background-color] hover:border-border hover:bg-card/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:cursor-pointer"
          aria-expanded={open()}
          aria-haspopup="listbox"
          aria-labelledby="auth-lang-label"
          aria-controls="auth-lang-listbox"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open());
          }}
        >
          
          <span class="flex min-w-0 flex-1 items-center gap-3 ps-3.5 py-2.5 pe-2">
            <span class="select-none text-xl leading-none" aria-hidden="true">
              {current().flag}
            </span>
            <span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {current().label}
            </span>
          </span>
          <span
            class="flex w-11 shrink-0 flex-col items-center justify-center border-s border-border/60 bg-muted/20 ps-1 pe-1 transition-colors group-hover:bg-muted/35"
            aria-hidden="true"
          >
            <i
              class={`fa-solid fa-chevron-down text-[0.65rem] text-muted-foreground transition-transform duration-200 ${open() ? 'rotate-180' : ''}`}
            />
          </span>
        </button>

        <Show when={open()}>
          <div
            id="auth-lang-listbox"
            role="listbox"
            aria-labelledby="auth-lang-label"
            class="absolute end-0 top-[calc(100%+0.5rem)] z-10 min-w-full overflow-hidden rounded-2xl border border-border/90 bg-card/95 p-0 shadow-xl shadow-black/40 backdrop-blur-xl"
          >
            <For each={LOCALES}>
              {(l) => {
                const active = () => l.code === lang();
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={active()}
                    class={`flex w-full items-center gap-3 rounded-none px-3 py-2.5 text-start text-sm transition-colors first:rounded-t-2xl last:rounded-b-2xl sm:px-3.5 sm:py-3 hover:cursor-pointer ${
                      active()
                        ? 'bg-primary/15 font-semibold text-foreground'
                        : 'text-foreground/90 hover:bg-accent/50 active:bg-accent/70'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void onSelect(l.code);
                    }}
                  >
                    <span class="select-none text-lg leading-none" aria-hidden="true">
                      {l.flag}
                    </span>
                    <span class="min-w-0 flex-1">{l.label}</span>
                    <Show when={active()}>
                      <i class="fa-solid fa-check shrink-0 text-xs text-primary" aria-hidden="true" />
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
