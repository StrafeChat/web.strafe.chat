import type { Component } from 'solid-js';
import { For, Show, createEffect, createSignal, on, onCleanup } from 'solid-js';
import { appearance, setGifProvider } from '../../stores/appearance';
import {
  fetchGifs,
  gifProviderConfigured,
  gifProviderInfo,
  GifNotConfiguredError,
  GIF_PROVIDERS,
  type GifProviderId,
  type GifResult,
} from '../../lib/gif/providers';
import { SearchInput } from '../ui/SearchInput';
import { t } from '../../i18n';

export interface GifPickerProps {
  onPick: (gif: GifResult) => void;
  /** Focus the search box on open. Off on mobile (would re-pop the keyboard). Defaults to true. */
  autofocusSearch?: boolean;
}

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 350;
/** Load the next page when the grid is scrolled to within this many px of the bottom. */
const INFINITE_SCROLL_MARGIN_PX = 400;

type LoadState = 'ok' | 'config' | 'error';

/**
 * GIF picker: trending by default, live search, infinite scroll, backed by the provider the
 * user chose (GIPHY or Heypster) - switchable right here in the header. Clicking a GIF calls
 * onPick with the result; the composer sends its .gif URL as a message. See lib/gif/providers.
 */
export const GifPicker: Component<GifPickerProps> = (props) => {
  const [query, setQuery] = createSignal('');
  const [debounced, setDebounced] = createSignal('');
  const [items, setItems] = createSignal<GifResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [state, setState] = createSignal<LoadState>('ok');
  const [done, setDone] = createSignal(false);
  let offset = 0;
  let reqId = 0;
  let controller: AbortController | undefined;
  let debounceTimer: number | undefined;
  let gridEl: HTMLDivElement | undefined;

  const provider = () => appearance.gifProvider;

  onCleanup(() => {
    controller?.abort();
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  // Debounce typing into the actual query that drives fetches.
  createEffect(
    on(query, (q) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => setDebounced(q.trim()), SEARCH_DEBOUNCE_MS);
    })
  );

  async function load(reset: boolean) {
    const id = provider();
    if (!gifProviderConfigured(id)) {
      setState('config');
      setItems([]);
      return;
    }
    if (loading()) return;
    if (!reset && done()) return;
    const myReq = ++reqId;
    controller?.abort();
    controller = new AbortController();
    setLoading(true);
    try {
      const page = await fetchGifs(id, {
        query: debounced(),
        offset: reset ? 0 : offset,
        limit: PAGE_SIZE,
        signal: controller.signal,
      });
      if (myReq !== reqId) return; // a newer request superseded this one
      offset = page.nextOffset;
      setItems(reset ? page.results : [...items(), ...page.results]);
      setDone(page.results.length === 0 || page.nextOffset >= page.totalCount);
      setState('ok');
      // A short first page that didn't fill the viewport should immediately pull the next.
      queueMicrotask(maybeLoadMore);
    } catch (e) {
      if (myReq !== reqId || (e instanceof DOMException && e.name === 'AbortError')) return;
      setState(e instanceof GifNotConfiguredError ? 'config' : 'error');
      if (reset) setItems([]);
    } finally {
      if (myReq === reqId) setLoading(false);
    }
  }

  // Reset and reload whenever the query or the chosen provider changes.
  createEffect(
    on([debounced, provider], () => {
      offset = 0;
      setDone(false);
      void load(true);
    })
  );

  function maybeLoadMore() {
    const el = gridEl;
    if (!el || loading() || done() || state() !== 'ok') return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= INFINITE_SCROLL_MARGIN_PX) void load(false);
  }

  const aspect = (g: GifResult) => (g.previewWidth > 0 && g.previewHeight > 0 ? g.previewWidth / g.previewHeight : 1);

  return (
    <div class="flex min-h-0 flex-1 flex-col" data-no-tooltip>
      <div class="flex items-center gap-2 border-b border-border/70 p-2">
        <SearchInput
          size="sm"
          value={query()}
          onValueChange={setQuery}
          placeholder={t('gif.search', { provider: gifProviderInfo(provider()).name })}
          aria-label={t('gif.search', { provider: gifProviderInfo(provider()).name })}
          autofocus={props.autofocusSearch !== false}
          wrapperClass="flex-1"
        />
        <div class="flex shrink-0 rounded-lg bg-muted/40 p-0.5" role="radiogroup" aria-label={t('gif.provider')}>
          <For each={GIF_PROVIDERS}>
            {(p) => (
              <button
                type="button"
                role="radio"
                aria-checked={provider() === p.id}
                class={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                  provider() === p.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setGifProvider(p.id as GifProviderId)}
              >
                {p.name}
              </button>
            )}
          </For>
        </div>
      </div>

      <div ref={(el) => (gridEl = el)} class="min-h-0 flex-1 overflow-y-auto p-2" onScroll={maybeLoadMore}>
        <Show when={state() === 'config'}>
          <div class="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <i class="fa-solid fa-film text-2xl text-muted-foreground/60" aria-hidden="true" />
            <p class="text-sm font-medium text-foreground">{t('gif.notConfiguredTitle', { provider: gifProviderInfo(provider()).name })}</p>
            <p class="text-xs leading-snug text-muted-foreground">{t('gif.notConfiguredBody')}</p>
          </div>
        </Show>
        <Show when={state() === 'error'}>
          <div class="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <i class="fa-solid fa-triangle-exclamation text-2xl text-muted-foreground/60" aria-hidden="true" />
            <p class="text-sm text-muted-foreground">{t('gif.error')}</p>
            <button type="button" class="text-xs font-medium text-primary hover:underline" onClick={() => void load(true)}>
              {t('common.retry')}
            </button>
          </div>
        </Show>
        <Show when={state() === 'ok'}>
          <Show when={!loading() && items().length === 0}>
            <p class="px-1 pt-6 text-center text-xs text-muted-foreground">{t('gif.none')}</p>
          </Show>
          {/* Masonry: CSS columns keep GIFs at their native aspect ratio without gaps. */}
          <div class="[column-gap:0.5rem] columns-2">
            <For each={items()}>
              {(gif) => (
                <button
                  type="button"
                  class="group relative mb-2 block w-full overflow-hidden rounded-md bg-muted/40 transition-[transform] hover:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ 'aspect-ratio': `${aspect(gif)}` }}
                  title={gif.title || undefined}
                  aria-label={gif.title || t('gif.item')}
                  onClick={() => props.onPick(gif)}
                >
                  <img
                    src={gif.previewUrl}
                    alt={gif.title || ''}
                    loading="lazy"
                    draggable={false}
                    class="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                  />
                </button>
              )}
            </For>
          </div>
          <Show when={loading()}>
            <div class="flex justify-center py-3">
              <i class="fa-solid fa-circle-notch animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          </Show>
        </Show>
      </div>

      <a
        href={gifProviderInfo(provider()).homepage}
        target="_blank"
        rel="noopener noreferrer"
        class="flex h-7 shrink-0 items-center justify-center border-t border-border/70 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        {gifProviderInfo(provider()).attribution}
      </a>
    </div>
  );
};
