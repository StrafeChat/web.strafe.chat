import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, createUniqueId, onCleanup, Show, untrack } from 'solid-js';
import { Portal } from 'solid-js/web';
import { t } from '../../i18n';
import { fieldLabelClass, inputBaseClass } from './Input';
import { appMenuPanel, zLayer } from '../../theme/appChrome';
import { isDesktop } from '../../desktop/env';

export interface ColorPickerProps {
  label?: string;
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  class?: string;
  compact?: boolean;
}

interface Hsv {
  h: number;
  s: number;
  v: number;
}

interface EyeDropperConstructor {
  new (): { open: () => Promise<{ sRGBHex: string }> };
}

const PANEL_MARGIN = 8;
const PANEL_GAP = 6;
const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 300;
const HUE_GRADIENT = 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function wrapHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw
      .split('')
      .map((c) => c + c)
      .join('')}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`.toLowerCase();
  return null;
}

function hexToHsv(hex: string): Hsv {
  const raw = (normalizeHex(hex) ?? '#000000').slice(1);
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

function hsvToHex(hue: number, sat: number, val: number): string {
  const h = wrapHue(hue);
  const c = val * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = val - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const channel = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function getEyeDropper(): EyeDropperConstructor | undefined {
  return (window as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper;
}

type DragTarget = 'sv' | 'hue';

export const ColorPicker: Component<ColorPickerProps> = (props) => {
  const fieldId = createUniqueId();
  const hexId = `${fieldId}-hex`;
  const initialHex = untrack(() => normalizeHex(props.value)) ?? '#000000';
  const initialHsv = hexToHsv(initialHex);

  const [open, setOpen] = createSignal(false);
  const [hue, setHue] = createSignal(initialHsv.h);
  const [sat, setSat] = createSignal(initialHsv.s);
  const [val, setVal] = createSignal(initialHsv.v);
  const [hex, setHex] = createSignal(initialHex);
  const [hexDraft, setHexDraft] = createSignal(initialHex);
  const [hexError, setHexError] = createSignal(false);
  const [panelPos, setPanelPos] = createSignal<{ left: number; top: number } | null>(null);

  let rootEl: HTMLDivElement | undefined;
  let triggerEl: HTMLButtonElement | undefined;
  let panelEl: HTMLDivElement | undefined;
  let svEl: HTMLDivElement | undefined;
  let hueEl: HTMLDivElement | undefined;
  let lastEmitted = '';
  let dragTarget: DragTarget | null = null;
  let dragPointer = -1;

  const color = () => hex();
  const hueColor = createMemo(() => hsvToHex(hue(), 1, 1));
  const canPickFromScreen = typeof window !== 'undefined' && !isDesktop() && !!getEyeDropper();

  function syncFromHex(next: string) {
    const hsv = hexToHsv(next);
    setHue(hsv.h);
    setSat(hsv.s);
    setVal(hsv.v);
    setHex(next);
    setHexDraft(next);
    setHexError(false);
  }

  function emit(next: string, hsv?: Hsv) {
    const raw = normalizeHex(next);
    if (!raw) return;
    lastEmitted = raw;
    const resolved = hsv ?? hexToHsv(raw);
    setHue(resolved.h);
    setSat(resolved.s);
    setVal(resolved.v);
    setHex(raw);
    setHexDraft(raw);
    setHexError(false);
    props.onChange(raw);
  }

  function commit(h: number, s: number, v: number) {
    const hsv = { h: wrapHue(h), s: clamp01(s), v: clamp01(v) };
    emit(hsvToHex(hsv.h, hsv.s, hsv.v), hsv);
  }

  function applyHex(input: string): boolean {
    const raw = normalizeHex(input);
    if (!raw) return false;
    emit(raw);
    return true;
  }

  createEffect(() => {
    const next = normalizeHex(props.value);
    if (!next || next === lastEmitted) return;
    lastEmitted = next;
    syncFromHex(next);
  });

  function positionPanel() {
    const trigger = triggerEl;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = panelEl?.offsetWidth || PANEL_WIDTH;
    const height = panelEl?.offsetHeight || PANEL_HEIGHT;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const left = Math.min(
      Math.max(PANEL_MARGIN, rect.left),
      Math.max(PANEL_MARGIN, viewportWidth - width - PANEL_MARGIN),
    );
    let top = rect.bottom + PANEL_GAP;
    if (top + height > viewportHeight - PANEL_MARGIN) {
      const above = rect.top - height - PANEL_GAP;
      top = above >= PANEL_MARGIN ? above : Math.max(PANEL_MARGIN, viewportHeight - height - PANEL_MARGIN);
    }
    setPanelPos({ left, top });
  }

  function anchorPanel() {
    const rect = triggerEl?.getBoundingClientRect();
    if (!rect) return;
    setPanelPos({
      left: Math.max(
        PANEL_MARGIN,
        Math.min(rect.left, Math.max(PANEL_MARGIN, window.innerWidth - PANEL_WIDTH - PANEL_MARGIN)),
      ),
      top: rect.bottom + PANEL_GAP,
    });
  }

  function onDragMove(e: PointerEvent) {
    if (!dragTarget || (dragPointer !== -1 && e.pointerId !== dragPointer)) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      endDrag();
      return;
    }
    if (dragTarget === 'sv') applySv(e.clientX, e.clientY);
    else applyHue(e.clientX);
  }

  function endDrag() {
    if (!dragTarget) return;
    dragTarget = null;
    dragPointer = -1;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
  }

  function applySv(clientX: number, clientY: number) {
    const el = svEl;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    commit(hue(), (clientX - rect.left) / rect.width, 1 - (clientY - rect.top) / rect.height);
  }

  function applyHue(clientX: number) {
    const el = hueEl;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    commit(clamp01((clientX - rect.left) / rect.width) * 360, sat(), val());
  }

  function startDrag(target: DragTarget, e: PointerEvent) {
    if (props.disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    endDrag();
    dragTarget = target;
    dragPointer = e.pointerId;
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    if (target === 'sv') {
      svEl?.focus({ preventScroll: true });
      applySv(e.clientX, e.clientY);
    } else {
      hueEl?.focus({ preventScroll: true });
      applyHue(e.clientX);
    }
  }

  function onSvKeyDown(e: KeyboardEvent) {
    const step = e.shiftKey ? 0.1 : 0.01;
    let s = sat();
    let v = val();
    if (e.key === 'ArrowLeft') s -= step;
    else if (e.key === 'ArrowRight') s += step;
    else if (e.key === 'ArrowDown') v -= step;
    else if (e.key === 'ArrowUp') v += step;
    else return;
    e.preventDefault();
    commit(hue(), s, v);
  }

  function onHueKeyDown(e: KeyboardEvent) {
    const step = e.shiftKey ? 10 : 1;
    let next = hue();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next -= step;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next += step;
    else if (e.key === 'PageDown') next -= 10;
    else if (e.key === 'PageUp') next += 10;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 359;
    else return;
    e.preventDefault();
    commit(next, sat(), val());
  }

  function onHexInput(value: string) {
    setHexDraft(value);
    setHexError(false);
    if (/^#?[0-9a-f]{6}$/i.test(value.trim())) applyHex(value);
  }

  function onHexBlur() {
    if (!hexDraft().trim()) {
      setHexDraft(color());
      setHexError(false);
      return;
    }
    if (!applyHex(hexDraft())) setHexError(true);
  }

  function onHexKeyDown(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (applyHex(hexDraft())) e.currentTarget.blur();
    else setHexError(true);
  }

  async function pickFromScreen() {
    const EyeDropper = getEyeDropper();
    if (!EyeDropper) return;
    try {
      const result = await new EyeDropper().open();
      applyHex(result.sRGBHex);
    } catch {
      return;
    }
  }

  createEffect(() => {
    if (!open()) {
      setPanelPos(null);
      endDrag();
      return;
    }
    if (panelEl) positionPanel();
    else requestAnimationFrame(positionPanel);
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target && (rootEl?.contains(target) || panelEl?.contains(target))) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      triggerEl?.focus({ preventScroll: true });
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
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    });
  });

  onCleanup(endDrag);

  return (
    <div
      ref={(el) => (rootEl = el)}
      class={`relative ${props.compact ? 'inline-flex shrink-0' : 'w-full space-y-1.5'} ${props.class ?? ''}`}
    >
      <Show when={props.label && !props.compact}>
        <span class={fieldLabelClass}>{props.label}</span>
      </Show>

      <button
        ref={(el) => (triggerEl = el)}
        id={fieldId}
        type="button"
        disabled={props.disabled}
        onClick={() => {
          if (open()) {
            setOpen(false);
            return;
          }
          setHexDraft(untrack(color));
          setHexError(false);
          anchorPanel();
          setOpen(true);
        }}
        class={
          props.compact
            ? 'size-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border/70 p-0 shadow-inner transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50'
            : `${inputBaseClass} h-10 min-h-10 cursor-pointer items-center gap-2.5 px-3 py-2 text-start disabled:pointer-events-none`
        }
        aria-haspopup="dialog"
        aria-expanded={open()}
        aria-label={`${props.label ?? t('colorPicker.open')}: ${color()}`}
        data-color-picker-trigger
      >
        <Show
          when={props.compact}
          fallback={
            <>
              <span
                class="size-6 shrink-0 rounded-full border border-border shadow-inner"
                style={{ 'background-color': color() }}
                aria-hidden="true"
              />
              <span class="font-mono text-xs uppercase text-foreground">{color()}</span>
              <i class="fa-solid fa-chevron-down ms-auto shrink-0 text-[10px] text-muted-foreground" aria-hidden="true" />
            </>
          }
        >
          <span class="block size-full" style={{ 'background-color': color() }} aria-hidden="true" />
        </Show>
      </button>

      <Show when={open()}>
        <Portal mount={document.body}>
          <div
            ref={(el) => (panelEl = el)}
            class={`fixed ${zLayer.popover} w-80 max-w-[calc(100vw-1rem)] max-h-[calc(100vh-1rem)] overflow-y-auto overscroll-contain ${appMenuPanel}`}
            style={{
              left: `${panelPos()?.left ?? 0}px`,
              top: `${panelPos()?.top ?? 0}px`,
              visibility: panelPos() ? 'visible' : 'hidden',
            }}
            role="dialog"
            aria-label={props.label ?? t('colorPicker.open')}
            data-color-picker-panel
          >
            <div class="flex flex-col gap-3 p-2">
              <div
                ref={(el) => (svEl = el)}
                class="relative h-36 w-full cursor-crosshair touch-none overflow-hidden rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor()})`,
                }}
                role="slider"
                tabIndex={0}
                aria-label={t('colorPicker.saturationBrightness')}
                aria-valuetext={color()}
                onPointerDown={(e) => startDrag('sv', e)}
                onKeyDown={onSvKeyDown}
                data-color-picker-sv
              >
                <span
                  class="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
                  style={{
                    left: `${(sat() * 100).toFixed(2)}%`,
                    top: `${((1 - val()) * 100).toFixed(2)}%`,
                    'background-color': color(),
                  }}
                  aria-hidden="true"
                />
              </div>

              <div
                ref={(el) => (hueEl = el)}
                class="relative h-3 w-full cursor-pointer touch-none rounded-full border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                style={{ background: HUE_GRADIENT }}
                role="slider"
                tabIndex={0}
                aria-label={t('colorPicker.hue')}
                aria-valuemin={0}
                aria-valuemax={359}
                aria-valuenow={Math.round(hue())}
                onPointerDown={(e) => startDrag('hue', e)}
                onKeyDown={onHueKeyDown}
                data-color-picker-hue
              >
                <span
                  class="pointer-events-none absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.55),0_1px_4px_rgba(0,0,0,0.45)]"
                  style={{ left: `${((hue() / 360) * 100).toFixed(2)}%`, 'background-color': color() }}
                  aria-hidden="true"
                />
              </div>

              <div class="flex items-start gap-2">
                <label for={hexId} class="sr-only">
                  {t('colorPicker.hex')}
                </label>
                <input
                  id={hexId}
                  type="text"
                  value={hexDraft()}
                  disabled={props.disabled}
                  spellcheck={false}
                  autocomplete="off"
                  onInput={(e) => onHexInput(e.currentTarget.value)}
                  onBlur={onHexBlur}
                  onKeyDown={onHexKeyDown}
                  class={`h-9 min-w-0 flex-1 rounded-lg border bg-background/80 px-2.5 font-mono text-xs uppercase text-foreground placeholder:text-muted-foreground transition-colors focus:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                    hexError() ? 'border-destructive' : 'border-input'
                  }`}
                  placeholder={t('colorPicker.hexPlaceholder')}
                  aria-label={t('colorPicker.hex')}
                  aria-invalid={hexError()}
                  data-color-picker-hex
                />
                <Show when={canPickFromScreen}>
                  <button
                    type="button"
                    class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-input bg-background/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    onClick={pickFromScreen}
                    aria-label={t('colorPicker.pickFromScreen')}
                    title={t('colorPicker.pickFromScreen')}
                    data-color-picker-eyedropper
                  >
                    <i class="fa-solid fa-eye-dropper text-sm" aria-hidden="true" />
                  </button>
                </Show>
              </div>

              <Show when={hexError()}>
                <p class="-mt-1 text-xs text-destructive" role="alert">
                  {t('colorPicker.invalidHex')}
                </p>
              </Show>
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
