import type { Component } from 'solid-js';
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { appMenuPanel, appSectionLabel, zLayer } from '../../theme/appChrome';
import { inputBaseClass } from '../ui/Input';
import {
  HAS_VALUES,
  activeFilterToken,
  applyFilterToken,
  type ActiveFilterToken,
  type SearchChannel,
  type SearchFilterKey,
  type SearchIdentity,
} from '../../lib/messageSearch';
import { t } from '../../i18n';

export interface MessageSearchBoxProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Enter, or picking "Search for …": run the query. */
  onSubmit: (raw: string) => void;
  people?: SearchIdentity[];
  /** Space channels, for `in:`. Omitted in PMs, which have nothing to scope to. */
  channels?: SearchChannel[];
  placeholder?: string;
}

/** One selectable row of the dropdown. */
type Row =
  | { kind: 'submit' }
  | { kind: 'showFilters' }
  | { kind: 'filter'; key: SearchFilterKey }
  | { kind: 'value'; key: SearchFilterKey; value: string; label: string; hint?: string };

const SUGGESTION_LIMIT = 4;

const FILTER_ICON: Record<SearchFilterKey, string> = {
  from: 'fa-solid fa-user',
  in: 'fa-solid fa-hashtag',
  has: 'fa-solid fa-paperclip',
  mentions: 'fa-solid fa-at',
};

function personLabel(p: SearchIdentity) {
  return p.display_name || p.username;
}

/**
 * The search field that lives in the room header, with Discord's dropdown: the filter list
 * when it's empty, matching users / channels / data types as you type, and `Enter` to run
 * the query. The results themselves render in RoomSearchPanel - this only ever builds the
 * query string.
 */
export const MessageSearchBox: Component<MessageSearchBoxProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  const [showAllFilters, setShowAllFilters] = createSignal(false);
  const [caret, setCaret] = createSignal(0);
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [anchor, setAnchor] = createSignal<{ top: number; right: number } | null>(null);
  let wrapperEl: HTMLDivElement | undefined;
  let inputEl: HTMLInputElement | undefined;

  const token = createMemo<ActiveFilterToken | null>(() => activeFilterToken(props.value, caret()));
  const trimmed = () => props.value.trim();

  function measure() {
    if (!wrapperEl) return;
    const r = wrapperEl.getBoundingClientRect();
    setAnchor({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  }

  createEffect(() => {
    if (!open()) return;
    measure();
    const onScroll = () => measure();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    onCleanup(() => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    });
  });

  const onDocMouseDown = (e: MouseEvent) => {
    const target = e.target as Node;
    if (wrapperEl?.contains(target)) return;
    if ((target as HTMLElement)?.closest?.('[data-search-dropdown]')) return;
    setOpen(false);
  };
  document.addEventListener('mousedown', onDocMouseDown);
  onCleanup(() => document.removeEventListener('mousedown', onDocMouseDown));

  function matchPeople(q: string): SearchIdentity[] {
    const people = props.people ?? [];
    const needle = q.replace(/^@/, '').toLowerCase();
    const hits = needle
      ? people.filter(
          (p) => p.username.toLowerCase().includes(needle) || (p.display_name ?? '').toLowerCase().includes(needle)
        )
      : people;
    return hits.slice(0, SUGGESTION_LIMIT);
  }

  function matchChannels(q: string): SearchChannel[] {
    const channels = props.channels ?? [];
    const needle = q.replace(/^#/, '').toLowerCase();
    const hits = needle ? channels.filter((c) => (c.name ?? '').toLowerCase().includes(needle)) : channels;
    return hits.slice(0, SUGGESTION_LIMIT);
  }

  /** The dropdown as a flat, keyboard-navigable list; section labels are derived from it. */
  const rows = createMemo<Row[]>(() => {
    const active = token();
    if (active) {
      const needle = active.value.toLowerCase();
      if (active.key === 'has') {
        return HAS_VALUES.filter((v) => v.startsWith(needle)).map((v) => ({
          kind: 'value' as const,
          key: 'has' as const,
          value: v,
          label: v,
        }));
      }
      if (active.key === 'in') {
        return matchChannels(active.value).map((c) => ({
          kind: 'value' as const,
          key: 'in' as const,
          value: c.name || c.id,
          label: c.name || c.id,
        }));
      }
      return matchPeople(active.value).map((p) => ({
        kind: 'value' as const,
        key: active.key,
        value: p.username,
        label: personLabel(p),
        hint: `${active.key}: ${p.username}`,
      }));
    }

    const filterKeys: SearchFilterKey[] = props.channels ? ['from', 'in', 'has', 'mentions'] : ['from', 'has', 'mentions'];
    if (!trimmed() || showAllFilters()) {
      const head: Row[] = trimmed() ? [{ kind: 'submit' }] : [];
      return head.concat(filterKeys.map((key) => ({ kind: 'filter' as const, key })));
    }

    const q = trimmed();
    const out: Row[] = [{ kind: 'submit' }, { kind: 'showFilters' }];
    for (const p of matchPeople(q)) {
      out.push({ kind: 'value', key: 'from', value: p.username, label: personLabel(p), hint: `from: ${p.username}` });
    }
    if (props.channels) {
      for (const c of matchChannels(q)) {
        out.push({ kind: 'value', key: 'in', value: c.name || c.id, label: c.name || c.id, hint: `in: ${c.name || c.id}` });
      }
    }
    for (const p of matchPeople(q)) {
      out.push({
        kind: 'value',
        key: 'mentions',
        value: p.username,
        label: personLabel(p),
        hint: `mentions: ${p.username}`,
      });
    }
    return out;
  });

  // A shrinking list must never leave the highlight pointing past its end.
  createEffect(() => {
    const n = rows().length;
    if (activeIndex() >= n) setActiveIndex(n > 0 ? n - 1 : 0);
  });

  function sectionLabelFor(index: number): string | null {
    const list = rows();
    const row = list[index];
    if (!row || row.kind !== 'value') return null;
    const prev = list[index - 1];
    if (prev && prev.kind === 'value' && prev.key === row.key) return null;
    if (token()) return t(`room.search.filters.${row.key}.title`);
    return t(`room.search.sections.${row.key}`);
  }

  function focusInput() {
    queueMicrotask(() => {
      inputEl?.focus();
      const pos = inputEl?.value.length ?? 0;
      inputEl?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  }

  function choose(row: Row) {
    if (row.kind === 'submit') {
      submit();
      return;
    }
    if (row.kind === 'showFilters') {
      setShowAllFilters(true);
      setActiveIndex(0);
      focusInput();
      return;
    }
    if (row.kind === 'filter') {
      const base = props.value.length === 0 || /\s$/.test(props.value) ? props.value : `${props.value} `;
      props.onValueChange(`${base}${row.key}:`);
      setShowAllFilters(false);
      setActiveIndex(0);
      focusInput();
      return;
    }
    props.onValueChange(applyFilterToken(props.value, token(), row.key, row.value));
    setShowAllFilters(false);
    setActiveIndex(0);
    focusInput();
  }

  function submit() {
    const raw = props.value.trim();
    if (!raw) return;
    setOpen(false);
    setShowAllFilters(false);
    props.onSubmit(raw);
    inputEl?.blur();
  }

  function onKeyDown(e: KeyboardEvent) {
    const list = rows();
    if (e.key === 'Escape') {
      if (open()) {
        e.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!open()) {
        setOpen(true);
        return;
      }
      if (list.length === 0) return;
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((i) => (i + dir + list.length) % list.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const row = open() ? list[activeIndex()] : undefined;
      // A highlighted suggestion wins, except the very first row, which IS "search for
      // this" - so a plain type-and-Enter never gets hijacked by a name that happens to
      // match.
      if (row && row.kind !== 'submit') choose(row);
      else submit();
    }
  }

  return (
    <div class="relative hidden md:block" ref={(el) => (wrapperEl = el)}>
      <i
        class="fa-solid fa-magnifying-glass pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground"
        aria-hidden="true"
      />
      <input
        ref={(el) => (inputEl = el)}
        id="room-message-search"
        type="text"
        role="combobox"
        aria-expanded={open()}
        aria-autocomplete="list"
        aria-controls="room-message-search-dropdown"
        autocomplete="off"
        value={props.value}
        placeholder={props.placeholder ?? t('room.search.placeholder')}
        aria-label={t('room.searchMessages')}
        class={`${inputBaseClass} h-8 w-40 pl-7 pr-7 text-xs transition-[width] focus:w-64`}
        onInput={(e) => {
          props.onValueChange(e.currentTarget.value);
          setCaret(e.currentTarget.selectionStart ?? e.currentTarget.value.length);
          setShowAllFilters(false);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
        onKeyDown={onKeyDown}
      />
      <Show when={props.value}>
        <button
          type="button"
          class="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t('common.clear')}
          onClick={() => {
            props.onValueChange('');
            props.onSubmit('');
            focusInput();
          }}
        >
          <i class="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </Show>

      <Show when={open() && anchor() && rows().length > 0}>
        <Portal>
          <div
              id="room-message-search-dropdown"
              data-search-dropdown
              role="listbox"
              aria-label={t('room.searchMessages')}
              class={`fixed w-[26rem] max-w-[calc(100vw-1rem)] max-h-[70vh] overflow-y-auto ${zLayer.popover} ${appMenuPanel}`}
              style={{ top: `${anchor()!.top}px`, right: `${anchor()!.right}px` }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <Show when={!token() && !trimmed()}>
                <p class={`${appSectionLabel} px-2 pb-1 pt-1`}>{t('room.search.filtersTitle')}</p>
              </Show>
              <For each={rows()}>
                {(row, i) => (
                  <>
                    <Show when={sectionLabelFor(i())}>
                      {(label) => (
                        <p class={`${appSectionLabel} mt-1 border-t border-border/50 px-2 pb-1 pt-2 first:mt-0 first:border-0`}>
                          {label()}
                        </p>
                      )}
                    </Show>
                    <button
                      type="button"
                      role="option"
                      aria-selected={activeIndex() === i()}
                      class={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                        activeIndex() === i() ? 'bg-accent/70' : 'hover:bg-accent/50'
                      }`}
                      onMouseEnter={() => setActiveIndex(i())}
                      onClick={() => choose(row)}
                    >
                      <i
                        class={`w-4 shrink-0 text-center text-sm text-muted-foreground ${
                          row.kind === 'submit'
                            ? 'fa-solid fa-magnifying-glass'
                            : row.kind === 'showFilters'
                              ? 'fa-solid fa-sliders'
                              : FILTER_ICON[row.key]
                        }`}
                        aria-hidden="true"
                      />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm text-foreground">
                          {row.kind === 'submit'
                            ? t('room.search.searchFor', { query: trimmed() })
                            : row.kind === 'showFilters'
                              ? t('room.search.addFilters')
                              : row.kind === 'filter'
                                ? t(`room.search.filters.${row.key}.title`)
                                : row.label}
                        </span>
                        <Show when={row.kind === 'filter' || (row.kind === 'value' && row.hint)}>
                          <span class="block truncate text-xs text-muted-foreground">
                            {row.kind === 'filter' ? t(`room.search.filters.${row.key}.hint`) : row.kind === 'value' ? row.hint : ''}
                          </span>
                        </Show>
                      </span>
                    </button>
                  </>
                )}
              </For>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
