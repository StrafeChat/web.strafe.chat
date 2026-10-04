import type { Component } from 'solid-js';
import { For, Show, createEffect, createMemo, createResource, createSignal, on, onCleanup } from 'solid-js';
import type { CustomEmoji } from '../../api/emojis';
import { customEmojis } from '../../stores/customEmojis';
import { spaces } from '../../stores/spaces';
import { appearance, setEmojiSkinTone } from '../../stores/appearance';
import {
  EMOJI_GROUPS,
  SKIN_TONES,
  loadEmojiCatalog,
  searchEmoji,
  withSkinTone,
  type EmojiCatalog,
  type EmojiEntry,
} from '../../lib/emoji/data';
import { appMenuPanel } from '../../theme/appChrome';
import { SearchInput } from '../ui/SearchInput';
import { Emoji } from './Emoji';
import { t } from '../../i18n';

export type EmojiPick = { unicode: string; custom?: undefined } | { unicode?: undefined; custom: CustomEmoji };

export interface EmojiPickerProps {
  onPick: (pick: EmojiPick) => void;
  onClose: () => void;
  /** When embedded in the ExpressionPicker (composer), the parent owns the panel chrome and
   * outside-click/Escape, and this fills the parent instead of being its own fixed-size card. */
  embedded?: boolean;
  /** Focus the search box on open. Off on mobile, where it would re-pop the on-screen keyboard
   * the picker just replaced. Defaults to true. */
  autofocusSearch?: boolean;
  /** Offer only this space's custom emoji (the viewer lacks Use External Emojis in the room
   * being composed in), the way Discord greys out other servers' emoji. Unicode is unaffected. */
  customEmojiSpaceId?: string;
}

type CategoryId = 'recent' | `space:${string}` | `group:${number}`;

const RECENT_KEY = 'strafe_emoji_recent';
const RECENT_MAX = 32;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecent(key: string) {
  try {
    const next = [key, ...loadRecent().filter((k) => k !== key)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

type GridItem = { key: string; unicode?: string; entry?: EmojiEntry; custom?: CustomEmoji; label: string };

/**
 * Discord-style emoji picker: search, a category rail (recent, each space's custom emoji,
 * the Unicode groups), a grid, and a hover preview. Only the active category is rendered,
 * so switching to Twemoji images doesn't mean mounting 3,700 <img>s at once.
 */
export const EmojiPicker: Component<EmojiPickerProps> = (props) => {
  const [catalog] = createResource<EmojiCatalog>(() => loadEmojiCatalog());
  const [query, setQuery] = createSignal('');
  const [category, setCategory] = createSignal<CategoryId>('recent');
  const [hovered, setHovered] = createSignal<GridItem | null>(null);
  const [recent, setRecent] = createSignal<string[]>(loadRecent());
  const [toneOpen, setToneOpen] = createSignal(false);
  let rootEl: HTMLDivElement | undefined;

  const tone = () => appearance.emojiSkinTone;

  const allowsSpace = (spaceId: string | null | undefined) =>
    props.customEmojiSpaceId === undefined || spaceId === props.customEmojiSpaceId;

  const spaceCategories = createMemo(() =>
    Object.entries(customEmojis.bySpaceId)
      .filter(([spaceId, list]) => list.length > 0 && allowsSpace(spaceId))
      .map(([spaceId, list]) => {
        const space = spaces.spaces.find((s) => s.id === spaceId);
        return { id: `space:${spaceId}` as CategoryId, spaceId, name: space?.name ?? t('emoji.picker.space'), icon: space?.icon, acronym: space?.name_acronym || (space?.name ?? '?').slice(0, 2), list };
      })
  );

  // Recent is empty on a fresh install - land on smileys instead of a blank grid.
  createEffect(() => {
    if (category() === 'recent' && recent().length === 0) setCategory('group:0');
  });

  const unicodeItem = (e: EmojiEntry): GridItem => ({
    key: `u:${e.hexcode}`,
    unicode: withSkinTone(e, tone()),
    entry: e,
    label: `:${e.shortcode}:`,
  });
  const customItem = (c: CustomEmoji): GridItem => ({ key: `c:${c.id}`, custom: c, label: `:${c.name}:` });

  const items = createMemo((): GridItem[] => {
    const q = query().trim().toLowerCase();
    const cat = catalog();
    if (q) {
      const customHits = Object.values(customEmojis.bySpaceId)
        .flat()
        .filter((c) => allowsSpace(c.space_id) && c.name.toLowerCase().includes(q))
        .slice(0, 24)
        .map(customItem);
      const unicodeHits = cat ? searchEmoji(cat, q, 96).map(unicodeItem) : [];
      return [...customHits, ...unicodeHits];
    }
    const c = category();
    if (c === 'recent') {
      const out: GridItem[] = [];
      for (const key of recent()) {
        if (key.startsWith('c:')) {
          const custom = customEmojis.byId[key.slice(2)];
          if (custom && allowsSpace(custom.space_id)) out.push(customItem(custom));
        } else if (key.startsWith('u:') && cat) {
          const entry = cat.byUnicode.get(key.slice(2));
          if (entry) out.push(unicodeItem(entry));
        }
      }
      return out;
    }
    if (c.startsWith('space:')) {
      const sid = c.slice('space:'.length);
      return allowsSpace(sid) ? (customEmojis.bySpaceId[sid] ?? []).map(customItem) : [];
    }
    if (c.startsWith('group:') && cat) {
      return (cat.byGroup.get(Number(c.slice('group:'.length))) ?? []).map(unicodeItem);
    }
    return [];
  });

  const title = createMemo(() => {
    if (query().trim()) return t('emoji.picker.searchResults');
    const c = category();
    if (c === 'recent') return t('emoji.picker.recent');
    if (c.startsWith('space:')) return spaceCategories().find((s) => s.id === c)?.name ?? t('emoji.picker.custom');
    const group = EMOJI_GROUPS.find((g) => `group:${g.id}` === c);
    return group ? t(`emoji.groups.${group.key}`) : '';
  });

  function pick(item: GridItem) {
    if (item.custom) {
      pushRecent(`c:${item.custom.id}`);
      props.onPick({ custom: item.custom });
    } else if (item.entry) {
      pushRecent(`u:${item.entry.unicode}`);
      props.onPick({ unicode: item.unicode ?? item.entry.unicode });
    }
    setRecent(loadRecent());
  }

  // Outside click / Escape close the picker - but only when standalone (the reaction picker).
  // Embedded in the ExpressionPicker, the parent owns those so both tabs share one dismissal.
  if (!props.embedded) {
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootEl && !rootEl.contains(e.target as Node)) props.onClose();
    };
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        props.onClose();
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKey, true);
    onCleanup(() => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKey, true);
    });
  }

  let gridEl: HTMLDivElement | undefined;
  createEffect(on([category, query], () => gridEl?.scrollTo({ top: 0 })));

  const railBtn = (active: boolean) =>
    `flex size-9 shrink-0 items-center justify-center rounded-lg text-sm transition-colors ${
      active ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
    }`;

  return (
    <div
      ref={(el) => {
        rootEl = el;
      }}
      class={
        props.embedded
          ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
          : // Standalone (the reaction picker): fills the portal wrapper, which MessageList
            // sizes and positions (and clamps to the viewport) so the card is never clipped.
            `flex h-full w-full flex-col overflow-hidden ${appMenuPanel} !p-0`
      }
      role="dialog"
      aria-label={t('emoji.picker.title')}
      data-no-tooltip
    >
      <div class="flex items-center gap-2 border-b border-border/70 p-2">
        <SearchInput
          size="sm"
          value={query()}
          onValueChange={setQuery}
          placeholder={t('emoji.picker.search')}
          aria-label={t('emoji.picker.search')}
          autofocus={props.autofocusSearch !== false}
          wrapperClass="flex-1"
        />
        <div class="relative">
          <button
            type="button"
            class="size-7 rounded-full border-2 border-border/60 transition-transform hover:scale-110"
            style={{ 'background-color': SKIN_TONES[tone()]?.swatch }}
            title={t('settings.appearance.emoji.skinTone')}
            aria-label={t('emoji.picker.chooseSkinTone')}
            onClick={() => setToneOpen((v) => !v)}
          />
          <Show when={toneOpen()}>
            <div class={`absolute end-0 top-full z-10 mt-1 flex gap-1 ${appMenuPanel}`}>
              <For each={SKIN_TONES}>
                {(st) => (
                  <button
                    type="button"
                    class={`size-7 rounded-full border-2 ${st.tone === tone() ? 'border-primary' : 'border-transparent'}`}
                    style={{ 'background-color': st.swatch }}
                    title={t(`emoji.skinTones.${st.tone}`)}
                    onClick={() => {
                      setEmojiSkinTone(st.tone);
                      setToneOpen(false);
                    }}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>

      <div class="flex min-h-0 flex-1">
        <div class="flex w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto border-e border-border/70 p-1.5" role="tablist" aria-label={t('emoji.picker.categories')}>
          <button type="button" role="tab" aria-selected={category() === 'recent'} class={railBtn(category() === 'recent')} title={t('emoji.picker.recent')} onClick={() => { setQuery(''); setCategory('recent'); }}>
            <i class="fa-solid fa-clock-rotate-left" aria-hidden="true" />
          </button>
          <For each={spaceCategories()}>
            {(s) => (
              <button
                type="button"
                role="tab"
                aria-selected={category() === s.id}
                class={`${railBtn(category() === s.id)} overflow-hidden`}
                title={s.name}
                onClick={() => {
                  setQuery('');
                  setCategory(s.id);
                }}
              >
                <Show when={s.icon} fallback={<span class="text-[10px] font-bold uppercase">{s.acronym}</span>}>
                  <img src={s.icon!} alt="" class="size-6 rounded-md object-cover" />
                </Show>
              </button>
            )}
          </For>
          <Show when={spaceCategories().length > 0}>
            <span class="my-0.5 h-px w-6 shrink-0 bg-border/70" aria-hidden="true" />
          </Show>
          <For each={EMOJI_GROUPS}>
            {(g) => (
              <button
                type="button"
                role="tab"
                aria-selected={category() === `group:${g.id}`}
                class={railBtn(category() === `group:${g.id}`)}
                title={t(`emoji.groups.${g.key}`)}
                onClick={() => {
                  setQuery('');
                  setCategory(`group:${g.id}`);
                }}
              >
                <i class={`fa-solid ${g.icon}`} aria-hidden="true" />
              </button>
            )}
          </For>
        </div>

        <div
          ref={(el) => {
            gridEl = el;
          }}
          class="min-h-0 flex-1 overflow-y-auto p-2"
        >
          <p class="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title()}</p>
          <Show when={catalog.loading && !query() && !category().startsWith('space:')}>
            <p class="px-1 text-xs text-muted-foreground">{t('emoji.picker.loading')}</p>
          </Show>
          <Show when={!catalog.loading && items().length === 0}>
            <p class="px-1 text-xs text-muted-foreground">{t('emoji.picker.none')}</p>
          </Show>
          <div class="grid grid-cols-[repeat(auto-fill,2.25rem)] justify-center gap-0.5">
            <For each={items()}>
              {(item) => (
                <button
                  type="button"
                  class="flex size-9 items-center justify-center rounded-md transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={item.label}
                  onMouseEnter={() => setHovered(item)}
                  onFocus={() => setHovered(item)}
                  onClick={() => pick(item)}
                >
                  <Show when={item.custom} fallback={<Emoji emoji={item.unicode!} class="!m-0 !size-7" />}>
                    <img src={item.custom!.url} alt={item.label} class="size-7 object-contain" loading="lazy" draggable={false} />
                  </Show>
                </button>
              )}
            </For>
          </div>
        </div>
      </div>

      <div class="flex h-11 shrink-0 items-center gap-2 border-t border-border/70 px-3 text-sm">
        <Show when={hovered()} fallback={<span class="text-xs text-muted-foreground">{t('emoji.picker.pick')}</span>}>
          {(h) => (
            <>
              <Show when={h().custom} fallback={<Emoji emoji={h().unicode!} class="!m-0 !size-7" />}>
                <img src={h().custom!.url} alt="" class="size-7 object-contain" />
              </Show>
              <span class="truncate font-medium text-foreground">{h().label}</span>
              <Show when={h().custom}>
                <span class="truncate text-xs text-muted-foreground">
                  {spaces.spaces.find((s) => s.id === h().custom!.space_id)?.name ?? t('composer.customEmoji')}
                </span>
              </Show>
            </>
          )}
        </Show>
      </div>
    </div>
  );
};
