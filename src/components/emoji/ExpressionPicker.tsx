import type { Component } from 'solid-js';
import { Show, createSignal, onCleanup } from 'solid-js';
import { appMenuPanel } from '../../theme/appChrome';
import { EmojiPicker, type EmojiPick } from './EmojiPicker';
import { GifPicker } from '../gif/GifPicker';
import type { GifResult } from '../../lib/gif/providers';
import { t } from '../../i18n';

export type ExpressionTab = 'emoji' | 'gif';

export interface ExpressionPickerProps {
  onPickEmoji: (pick: EmojiPick) => void;
  onPickGif: (gif: GifResult) => void;
  onClose: () => void;
  /** Fill the parent (the mobile sheet that replaces the keyboard) instead of the fixed desktop card. */
  fill?: boolean;
  initialTab?: ExpressionTab;
}

/**
 * The composer's expression picker: an Emoji tab and a GIF tab under one panel, à la Discord.
 * Owns the panel chrome plus outside-click / Escape dismissal so both tabs share one dismissal;
 * the embedded EmojiPicker and GifPicker only render their content. On desktop it's a fixed
 * floating card; with `fill` it fills its parent - the mobile bottom sheet that takes the
 * on-screen keyboard's place (see RoomMessageInput).
 */
export const ExpressionPicker: Component<ExpressionPickerProps> = (props) => {
  const [tab, setTab] = createSignal<ExpressionTab>(props.initialTab ?? 'emoji');
  // The GIF tab fetches trending on mount, so don't mount it (or spend an API call) until the
  // user actually opens it; once opened it stays mounted to keep its results and scroll.
  const [gifActivated, setGifActivated] = createSignal((props.initialTab ?? 'emoji') === 'gif');
  const selectTab = (id: ExpressionTab) => {
    if (id === 'gif') setGifActivated(true);
    setTab(id);
  };
  let rootEl: HTMLDivElement | undefined;

  const onDocPointerDown = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (rootEl?.contains(target as Node)) return;
    // Ignore the composer's toggle buttons so a click on them isn't a close-then-reopen flicker.
    if (target?.closest?.('[data-expr-toggle]')) return;
    props.onClose();
  };
  const onDocKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      props.onClose();
    }
  };
  document.addEventListener('pointerdown', onDocPointerDown, true);
  document.addEventListener('keydown', onDocKey, true);
  onCleanup(() => {
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    document.removeEventListener('keydown', onDocKey, true);
  });

  const tabBtn = (id: ExpressionTab) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
      tab() === id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
    }`;

  return (
    <div
      ref={(el) => (rootEl = el)}
      class={
        props.fill
          ? 'flex h-full w-full flex-col overflow-hidden bg-card'
          : `flex h-[26rem] w-[22rem] max-w-full flex-col overflow-hidden ${appMenuPanel} !p-0`
      }
      role="dialog"
      aria-label={t('composer.expressionPicker')}
    >
      <div class="flex shrink-0 items-center gap-1 border-b border-border/70 p-1.5" role="tablist" aria-label={t('composer.expressionPicker')}>
        <button type="button" role="tab" aria-selected={tab() === 'emoji'} class={tabBtn('emoji')} onClick={() => selectTab('emoji')}>
          <i class="fa-solid fa-face-smile" aria-hidden="true" />
          {t('composer.emoji')}
        </button>
        <button type="button" role="tab" aria-selected={tab() === 'gif'} class={tabBtn('gif')} onClick={() => selectTab('gif')}>
          <i class="fa-solid fa-film" aria-hidden="true" />
          {t('gif.tab')}
        </button>
      </div>
      {/* Emoji stays mounted; the GIF tab mounts on first open, then both stay mounted (hidden
          when inactive) so switching tabs keeps each one's scroll position and results. */}
      <div class="flex min-h-0 flex-1" classList={{ hidden: tab() !== 'emoji' }}>
        <EmojiPicker embedded autofocusSearch={!props.fill} onClose={props.onClose} onPick={props.onPickEmoji} />
      </div>
      <Show when={gifActivated()}>
        <div class="flex min-h-0 flex-1" classList={{ hidden: tab() !== 'gif' }}>
          <GifPicker autofocusSearch={!props.fill} onPick={props.onPickGif} />
        </div>
      </Show>
    </div>
  );
};
