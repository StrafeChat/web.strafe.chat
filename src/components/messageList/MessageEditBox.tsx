import type { Component } from 'solid-js';
import { createSignal, onMount } from 'solid-js';
import { settings } from '../../stores/settings';
import { t } from '../../i18n';

export interface MessageEditBoxProps {
  initialValue: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

/** Composer grows with the edited message up to this, then scrolls. */
const MAX_HEIGHT_PX = 320;

/**
 * Inline message editor (Discord-style): the message text becomes a rounded, auto-growing
 * field that focuses itself on open with the caret at the end, and below it a small
 * "escape to cancel · enter to save" hint whose actions are clickable. Enter saves, Shift+Enter
 * newlines, Escape cancels. Autofocus is done imperatively - the browser's `autofocus`
 * attribute only fires on initial page load, not when this is inserted on demand.
 */
export const MessageEditBox: Component<MessageEditBoxProps> = (props) => {
  let el: HTMLTextAreaElement | undefined;
  const [value, setValue] = createSignal(props.initialValue);

  function grow() {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }

  onMount(() => {
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
    grow();
  });

  function save() {
    const text = value().trim();
    if (text) props.onSave(text);
    else props.onCancel(); // emptying and saving just cancels rather than sending a blank edit
  }

  return (
    <div class="py-1">
      <textarea
        ref={(e) => (el = e)}
        value={value()}
        rows={1}
        spellcheck={settings.spellcheck}
        placeholder={t('messages.editPlaceholder')}
        onInput={(e) => {
          setValue(e.currentTarget.value);
          grow();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            props.onCancel();
          } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            save();
          }
        }}
        class="block w-full resize-none overflow-hidden rounded-lg border border-input bg-background/70 px-3 py-2 text-sm leading-5 text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p class="mt-1 px-0.5 text-[11px] text-muted-foreground">
        {t('messages.editEscapeTo')}{' '}
        <button type="button" class="text-primary hover:underline" onClick={() => props.onCancel()}>
          {t('messages.editActionCancel')}
        </button>
        {' · '}
        {t('messages.editEnterTo')}{' '}
        <button type="button" class="text-primary hover:underline" onClick={save}>
          {t('messages.editActionSave')}
        </button>
      </p>
    </div>
  );
};
