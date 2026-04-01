import type { Component } from 'solid-js';
import { Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useReactiveTranslate } from '../../i18n';
import { appModalBackdrop } from '../../theme/appChrome';

export interface DatePickerFieldProps {
  id?: string;
  label?: string;
  /** Shown when no date is selected */
  emptyLabel?: string;
  /** ISO date `YYYY-MM-DD` or empty */
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  error?: string;
  class?: string;
  /** Show asterisk on label */
  required?: boolean;
}

type PickMode = 'days' | 'months' | 'years';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Local calendar date → YYYY-MM-DD */
export function toISODateLocal(y: number, m0: number, d: number) {
  return `${y}-${pad2(m0 + 1)}-${pad2(d)}`;
}

function parseISOToLocal(iso: string): { y: number; m0: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return { y, m0: mo, d };
}

function daysInMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}

function startWeekday(y: number, m0: number) {
  return new Date(y, m0, 1).getDay();
}

function todayLocal() {
  const t = new Date();
  return { y: t.getFullYear(), m0: t.getMonth(), d: t.getDate() };
}

function compareCalendar(a: { y: number; m0: number; d: number }, b: { y: number; m0: number; d: number }) {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m0 !== b.m0) return a.m0 - b.m0;
  return a.d - b.d;
}

function initialViewFromValue(iso: string) {
  const p = parseISOToLocal(iso);
  if (p) return { y: p.y, m0: p.m0 };
  const t = todayLocal();
  return { y: t.y, m0: t.m0 };
}

export const DatePickerField: Component<DatePickerFieldProps> = (props) => {
  const [t, actions] = useReactiveTranslate();
  const fieldId = props.id ?? `datepicker-${Math.random().toString(36).slice(2)}`;
  const [open, setOpen] = createSignal(false);
  const [view, setView] = createSignal(initialViewFromValue(props.value));
  const [pickMode, setPickMode] = createSignal<PickMode>('days');

  let rootEl: HTMLDivElement | undefined;

  const [isNarrow, setIsNarrow] = createSignal(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  );

  onMount(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    onCleanup(() => mq.removeEventListener('change', apply));
  });

  createEffect(() => {
    if (!open()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  createEffect(() => {
    if (!open() || !isNarrow()) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    onCleanup(() => {
      document.body.style.overflow = prev;
    });
  });

  const i18nLocale = createMemo(() => {
    t('datepicker.selectDate');
    return actions.getI18next().resolvedLanguage ?? actions.getI18next().language;
  });

  const valueDisplay = createMemo(() => {
    const iso = props.value;
    const lng = i18nLocale();
    if (!iso) return '';
    const p = parseISOToLocal(iso);
    if (!p) return '';
    return new Date(p.y, p.m0, p.d).toLocaleDateString(lng, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });

  const monthTitleLong = createMemo(() => {
    const v = view();
    const lng = i18nLocale();
    return new Date(v.y, v.m0, 1).toLocaleDateString(lng, { month: 'long' });
  });

  const weekdayShortLabels = createMemo(() =>
    [0, 1, 2, 3, 4, 5, 6].map((i) => t(`datepicker.weekdaysShort.${i}`)),
  );

  const monthShortLabels = createMemo(() =>
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => t(`datepicker.monthsShort.${i}`)),
  );

  createEffect(() => {
    if (!open()) return;
    const onDoc = (e: MouseEvent) => {
      if (rootEl && !rootEl.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc, true);
    onCleanup(() => document.removeEventListener('mousedown', onDoc, true));
  });

  /** When opening, focus calendar on the selected date’s month (or today). */
  createEffect(() => {
    if (open()) {
      setView(initialViewFromValue(props.value));
      setPickMode('days');
    } else {
      setPickMode('days');
    }
  });

  const yearNumber = () => view().y;

  /** Years for DOB-style picker: today back 120 years */
  const yearOptions = () => {
    const t = todayLocal();
    const out: number[] = [];
    for (let y = t.y; y >= t.y - 120; y--) out.push(y);
    return out;
  };

  const isFutureMonth = (m0: number) => {
    const v = view();
    const t = todayLocal();
    if (v.y > t.y) return true;
    if (v.y < t.y) return false;
    return m0 > t.m0;
  };

  const pickMonth = (m0: number) => {
    setView((v) => {
      const t = todayLocal();
      let y = v.y;
      let month = m0;
      if (y > t.y) y = t.y;
      if (y === t.y && month > t.m0) month = t.m0;
      return { y, m0: month };
    });
    setPickMode('days');
  };

  const pickYear = (y: number) => {
    const t = todayLocal();
    const clampedY = Math.min(y, t.y);
    setView((v) => {
      let m0 = v.m0;
      if (clampedY === t.y && m0 > t.m0) m0 = t.m0;
      return { y: clampedY, m0 };
    });
    setPickMode('days');
  };

  /** Full week rows: leading days from prev month, current month, trailing from next month */
  const calendarCells = () => {
    const vy = view().y;
    const vm0 = view().m0;
    const dim = daysInMonth(vy, vm0);
    const start = startWeekday(vy, vm0);
    const prevM0 = vm0 === 0 ? 11 : vm0 - 1;
    const prevY = vm0 === 0 ? vy - 1 : vy;
    const dimPrev = daysInMonth(prevY, prevM0);

    const cells: { y: number; m0: number; d: number; inMonth: boolean }[] = [];

    for (let i = 0; i < start; i++) {
      const d = dimPrev - start + 1 + i;
      cells.push({ y: prevY, m0: prevM0, d, inMonth: false });
    }
    for (let d = 1; d <= dim; d++) {
      cells.push({ y: vy, m0: vm0, d, inMonth: true });
    }

    const totalNeeded = Math.ceil(cells.length / 7) * 7;
    let ny = vm0 === 11 ? vy + 1 : vy;
    let nm0 = vm0 === 11 ? 0 : vm0 + 1;
    let nd = 1;
    while (cells.length < totalNeeded) {
      cells.push({ y: ny, m0: nm0, d: nd, inMonth: false });
      nd++;
      const dmax = daysInMonth(ny, nm0);
      if (nd > dmax) {
        nd = 1;
        if (nm0 === 11) {
          nm0 = 0;
          ny++;
        } else {
          nm0++;
        }
      }
    }
    return cells;
  };

  const selectDate = (y: number, m0: number, d: number) => {
    const iso = toISODateLocal(y, m0, d);
    props.onChange(iso);
    setOpen(false);
  };

  const prevMonth = () => {
    setView((v) => (v.m0 === 0 ? { y: v.y - 1, m0: 11 } : { y: v.y, m0: v.m0 - 1 }));
  };

  const monthIndex = (y: number, m0: number) => y * 12 + m0;

  const nextMonth = () => {
    const t = todayLocal();
    const maxM = monthIndex(t.y, t.m0);
    setView((v) => {
      const cur = monthIndex(v.y, v.m0);
      if (cur >= maxM) return v;
      if (v.m0 === 11) return { y: v.y + 1, m0: 0 };
      return { y: v.y, m0: v.m0 + 1 };
    });
  };

  const atCurrentMonth = () => {
    const v = view();
    const t = todayLocal();
    return monthIndex(v.y, v.m0) >= monthIndex(t.y, t.m0);
  };

  const isDateSelected = (y: number, m0: number, d: number) => {
    const p = parseISOToLocal(props.value);
    if (!p) return false;
    return p.y === y && p.m0 === m0 && p.d === d;
  };

  const isDateFuture = (y: number, m0: number, d: number) => {
    const t = todayLocal();
    return compareCalendar({ y, m0, d }, t) > 0;
  };

  const isDateToday = (y: number, m0: number, d: number) => {
    const t = todayLocal();
    return y === t.y && m0 === t.m0 && d === t.d;
  };

  let yearListRef: HTMLDivElement | undefined;

  /** Scroll selected year into view when opening year panel */
  createEffect(() => {
    if (pickMode() !== 'years' || !open()) return;
    queueMicrotask(() => {
      const el = yearListRef?.querySelector<HTMLElement>('[data-year-selected="true"]');
      el?.scrollIntoView({ block: 'nearest' });
    });
  });

  const renderPanel = () => (
    <Show
      when={pickMode() === 'days'}
      fallback={
        <Show
          when={pickMode() === 'months'}
          fallback={
            <div class="flex flex-col gap-2">
              <button
                type="button"
                class="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                onClick={() => setPickMode('days')}
              >
                <i class="fa-solid fa-arrow-left text-[10px]" />
                {t('datepicker.backToCalendar')}
              </button>
              <p class="text-xs font-medium text-muted-foreground">{t('datepicker.year')}</p>
              <div
                ref={(el) => (yearListRef = el)}
                class="datepicker-year-scroller max-h-[min(42dvh,15rem)] overflow-y-auto rounded-xl border border-border bg-muted/25 p-1 md:max-h-52"
                role="listbox"
                aria-label={t('datepicker.selectYear')}
              >
                {yearOptions().map((y) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={y === yearNumber()}
                    data-year-selected={y === yearNumber() ? 'true' : undefined}
                    class={`
                            w-full cursor-pointer rounded-lg px-3 py-2 text-center text-sm font-medium tabular-nums transition-colors duration-150
                            ${
                              y === yearNumber()
                                ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:brightness-95'
                                : 'text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80'
                            }
                          `}
                    onClick={() => pickYear(y)}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          <div class="flex flex-col gap-2">
            <button
              type="button"
              class="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground active:bg-accent/80"
              onClick={() => setPickMode('days')}
            >
              <i class="fa-solid fa-arrow-left text-[10px]" />
              {t('datepicker.backToCalendar')}
            </button>
            <div class="grid grid-cols-3 gap-1.5 rounded-xl border border-border bg-muted/25 p-1.5">
              {monthShortLabels().map((name, i) => (
                <button
                  type="button"
                  disabled={isFutureMonth(i)}
                  onClick={() => pickMonth(i)}
                  class={`
                          flex min-h-10 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors duration-150
                          disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent
                          ${
                            view().m0 === i
                              ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:brightness-95'
                              : 'text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80'
                          }
                        `}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </Show>
      }
    >
      <div>
        <div class="mb-3 flex items-center justify-between gap-1.5">
          <button
            type="button"
            class="size-9 shrink-0 cursor-pointer inline-flex items-center justify-center rounded-xl text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground active:scale-95"
            onClick={prevMonth}
            aria-label={t('datepicker.prevMonth')}
          >
            <i class="fa-solid fa-chevron-left text-xs" />
          </button>
          <div class="flex min-w-0 flex-1 items-center justify-center gap-1">
            <button
              type="button"
              class="max-w-[min(58%,11rem)] cursor-pointer truncate rounded-xl border border-transparent bg-muted/30 px-3 py-2 text-sm font-semibold tabular-nums text-foreground transition-colors duration-150 hover:border-border hover:bg-muted/60 active:bg-muted/80"
              onClick={() => setPickMode('months')}
              title={t('datepicker.chooseMonth')}
            >
              {monthTitleLong()}
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-xl border border-transparent bg-muted/30 px-3 py-2 text-sm font-semibold tabular-nums text-foreground transition-colors duration-150 hover:border-border hover:bg-muted/60 active:bg-muted/80"
              onClick={() => setPickMode('years')}
              title={t('datepicker.chooseYear')}
            >
              {yearNumber()}
            </button>
          </div>
          <button
            type="button"
            disabled={atCurrentMonth()}
            class="size-9 shrink-0 cursor-pointer inline-flex items-center justify-center rounded-xl text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            onClick={nextMonth}
            aria-label={t('datepicker.nextMonth')}
          >
            <i class="fa-solid fa-chevron-right text-xs" />
          </button>
        </div>

        <div class="mb-2 grid grid-cols-7 gap-0.5 border-b border-border/60 pb-2">
          {weekdayShortLabels().map((d) => (
            <div class="flex h-8 items-center justify-center">
              <span class="text-[10px] font-semibold tracking-wide text-muted-foreground">{d}</span>
            </div>
          ))}
        </div>

        <div class="grid grid-cols-7 gap-x-0.5 gap-y-1">
          {calendarCells().map((cell) => (
            <div class="flex aspect-square min-h-[2.25rem] items-center justify-center">
              <button
                type="button"
                disabled={isDateFuture(cell.y, cell.m0, cell.d)}
                onClick={() => selectDate(cell.y, cell.m0, cell.d)}
                class={`
                        datepicker-day-cell relative isolate box-border size-9 shrink-0 cursor-pointer overflow-hidden rounded-xl border-0 p-0
                        transition-colors duration-150
                        disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent
                        ${
                          !cell.inMonth
                            ? isDateSelected(cell.y, cell.m0, cell.d)
                              ? 'bg-primary/90 text-primary-foreground shadow-sm hover:bg-primary-hover active:brightness-95'
                              : 'text-muted-foreground/80 hover:bg-muted/70 hover:text-foreground active:bg-muted/50'
                            : isDateSelected(cell.y, cell.m0, cell.d)
                              ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:brightness-95'
                              : isDateToday(cell.y, cell.m0, cell.d)
                                ? 'bg-muted/80 text-foreground ring-1 ring-inset ring-primary/40 hover:bg-muted hover:ring-primary/60'
                                : 'text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80'
                        }
                      `}
              >
                <span class="datepicker-day-num pointer-events-none absolute left-1/2 top-1/2 whitespace-nowrap text-sm font-semibold tabular-nums">
                  {cell.d}
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </Show>
  );

  return (
    <div class={`w-full space-y-1.5 relative ${props.class ?? ''}`} ref={(el) => (rootEl = el)}>
      {props.label ? (
        <label for={fieldId} class="text-sm font-medium text-foreground">
          {props.label}
          {props.required ? <span class="text-destructive"> *</span> : null}
        </label>
      ) : null}

      <button
        type="button"
        id={fieldId}
        disabled={props.disabled}
        onClick={() => !props.disabled && setOpen(!open())}
        class={`
          box-border flex h-10 min-h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 py-2 text-start text-sm text-foreground
          transition-colors duration-150 hover:bg-accent/40 hover:border-border
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0
          disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input disabled:hover:bg-background
          ${props.error ? 'border-destructive' : ''}
        `}
        aria-haspopup="dialog"
        aria-expanded={open()}
      >
        <span class={`min-w-0 flex-1 truncate ${props.value ? 'text-foreground' : 'text-muted-foreground'}`}>
          {props.value ? valueDisplay() : (props.emptyLabel ?? t('datepicker.selectDate'))}
        </span>
        <span
          class="pointer-events-none inline-flex shrink-0 items-center justify-center text-muted-foreground"
          aria-hidden="true"
        >
          <i class="fa-solid fa-calendar-days fa-fw text-[15px] leading-none" />
        </span>
      </button>

      {props.error ? (
        <div class="flex gap-1.5 text-xs text-destructive" role="alert">
          <i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
          <span>{props.error}</span>
        </div>
      ) : null}

      <Show when={open()}>
        <Show
          when={isNarrow()}
          fallback={
            <div
              class="absolute left-0 right-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover p-3 shadow-2xl shadow-black/40"
              role="dialog"
              aria-label={t('datepicker.chooseDate')}
            >
              {renderPanel()}
            </div>
          }
        >
          <>
            <div
              class={`fixed inset-0 z-[199] ${appModalBackdrop}`}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div
              class="fixed inset-x-0 bottom-0 z-[200] flex max-h-[min(92dvh,38rem)] flex-col overflow-hidden rounded-t-3xl border border-border bg-popover pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_40px_-6px_rgba(0,0,0,0.55)]"
              role="dialog"
              aria-modal="true"
              aria-label={t('datepicker.chooseDate')}
            >
              <div class="mx-auto mt-2.5 h-1 w-11 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
              <div class="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
                <span class="text-base font-semibold text-foreground">{t('datepicker.chooseDate')}</span>
                <button
                  type="button"
                  class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => setOpen(false)}
                  aria-label={t('datepicker.close')}
                >
                  <i class="fa-solid fa-xmark text-lg leading-none" />
                </button>
              </div>
              <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2 pt-3">
                {renderPanel()}
              </div>
            </div>
          </>
        </Show>
      </Show>
    </div>
  );
};
