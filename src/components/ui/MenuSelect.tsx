import type { Component } from 'solid-js';
import { createEffect, createSignal, createUniqueId, For, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { appMenuItemDefault, appMenuPanel, zLayer } from '../../theme/appChrome';
import { fieldLabelClass, inputBaseClass } from './Input';

export interface MenuSelectOption {
  value: string;
  label: string;
}

interface MenuSelectProps {
  label?: string;
  /** Accessible name when the control has no visible label. */
  ariaLabel?: string;
  value: string;
  options: MenuSelectOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  class?: string;
}

const PANEL_MARGIN = 8;
const PANEL_GAP = 6;

export const MenuSelect: Component<MenuSelectProps> = (props) => {
  const labelId = `menu-select-label-${createUniqueId()}`;
  const [open, setOpen] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(-1);
  const [panelPos, setPanelPos] = createSignal<{
    left: number;
    width: number;
    maxHeight: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  let rootEl: HTMLDivElement | undefined;
  let triggerEl: HTMLButtonElement | undefined;
  let panelEl: HTMLDivElement | undefined;
  const optionEls: HTMLButtonElement[] = [];

  const selectedIndex = () => props.options.findIndex((option) => option.value === props.value);
  const selectedLabel = () => props.options.find((option) => option.value === props.value)?.label ?? '';

  function positionPanel() {
    const trigger = triggerEl;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(rect.width, window.innerWidth - PANEL_MARGIN * 2);
    const left = Math.min(
      Math.max(PANEL_MARGIN, rect.left),
      Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN)
    );
    const spaceBelow = window.innerHeight - rect.bottom - PANEL_GAP - PANEL_MARGIN;
    const spaceAbove = rect.top - PANEL_GAP - PANEL_MARGIN;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, openUp ? spaceAbove : spaceBelow);
    setPanelPos(
      openUp
        ? { left, width, maxHeight, bottom: window.innerHeight - rect.top + PANEL_GAP }
        : { left, width, maxHeight, top: rect.bottom + PANEL_GAP }
    );
  }

  function focusActive() {
    const el = optionEls[activeIndex()];
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
  }

  function openPanel() {
    if (props.disabled || open()) return;
    setActiveIndex(Math.max(0, selectedIndex()));
    positionPanel();
    setOpen(true);
  }

  function closePanel(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerEl?.focus({ preventScroll: true });
  }

  function selectValue(value: string) {
    props.onValueChange(value);
    closePanel(true);
  }

  createEffect(() => {
    if (!open()) {
      setPanelPos(null);
      return;
    }
    const raf = requestAnimationFrame(() => {
      positionPanel();
      focusActive();
    });
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target && (rootEl?.contains(target) || panelEl?.contains(target))) return;
      closePanel(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      closePanel(true);
    };
    const onReflow = (e: Event) => {
      if (e.type === 'scroll') {
        const target = e.target as Node | null;
        if (target && panelEl?.contains(target)) return;
      }
      positionPanel();
    };
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    onCleanup(() => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    });
  });

  function onTriggerKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    openPanel();
  }

  function onPanelKeyDown(e: KeyboardEvent) {
    if (!open()) return;
    const last = props.options.length - 1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const next =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? last
            : e.key === 'ArrowDown'
              ? Math.min(last, activeIndex() + 1)
              : Math.max(0, activeIndex() - 1);
      setActiveIndex(next);
      optionEls[next]?.focus({ preventScroll: true });
      optionEls[next]?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const option = props.options[activeIndex()];
      if (option) selectValue(option.value);
      return;
    }
    if (e.key === 'Tab') {
      closePanel(true);
    }
  }

  return (
    <div ref={(el) => (rootEl = el)} class="w-full space-y-1.5">
      <Show when={props.label}>
        <span id={labelId} class={fieldLabelClass}>
          {props.label}
        </span>
      </Show>
      <button
        ref={(el) => (triggerEl = el)}
        type="button"
        class={`${inputBaseClass} h-10 min-h-10 cursor-pointer items-center gap-2 px-3 py-2 text-start disabled:cursor-not-allowed disabled:opacity-50 ${props.class ?? ''}`}
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-label={props.label ? undefined : props.ariaLabel}
        aria-labelledby={props.label ? labelId : undefined}
        disabled={props.disabled}
        onClick={() => (open() ? closePanel(false) : openPanel())}
        onKeyDown={onTriggerKeyDown}
      >
        <span class="min-w-0 flex-1 truncate">{selectedLabel()}</span>
        <i
          class={`fa-solid fa-chevron-down shrink-0 text-[11px] text-muted-foreground transition-transform ${open() ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <Show when={open()}>
        <Portal mount={document.body}>
          <div
            ref={(el) => (panelEl = el)}
            role="listbox"
            aria-label={props.label ? undefined : props.ariaLabel}
            aria-labelledby={props.label ? labelId : undefined}
            class={`fixed ${zLayer.popover} ${appMenuPanel} overflow-y-auto overscroll-contain`}
            style={{
              left: `${panelPos()?.left ?? 0}px`,
              top: panelPos()?.top !== undefined ? `${panelPos()!.top}px` : undefined,
              bottom: panelPos()?.bottom !== undefined ? `${panelPos()!.bottom}px` : undefined,
              width: `${panelPos()?.width ?? 0}px`,
              'max-height': `${panelPos()?.maxHeight ?? 0}px`,
              visibility: panelPos() ? 'visible' : 'hidden',
            }}
            onKeyDown={onPanelKeyDown}
          >
            <For each={props.options}>
              {(option, index) => (
                <button
                  ref={(el) => (optionEls[index()] = el)}
                  type="button"
                  role="option"
                  aria-selected={option.value === props.value}
                  class={`${appMenuItemDefault} ${activeIndex() === index() ? 'bg-accent/70' : ''}`}
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIndex(index())}
                  onClick={() => selectValue(option.value)}
                >
                  <span class="min-w-0 flex-1 truncate">{option.label}</span>
                  <Show when={option.value === props.value}>
                    <i class="fa-solid fa-check text-xs text-primary" aria-hidden="true" />
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
