import {
  Component,
  createSignal,
  onCleanup,
  onMount,
  Show,
  For,
  createMemo,
} from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";
import { Portal } from "solid-js/web";

interface DatePickerProps {
  value: Date;
  onChange: (date: Date, isoString: string) => void;
  minDate?: Date;
  maxDate?: Date;
  class?: string;
}

const DatePicker: Component<DatePickerProps> = (props) => {
  const [t] = useTransContext();
  const [isOpen, setIsOpen] = createSignal(false);
  const [selectedDate, setSelectedDate] = createSignal(props.value);
  const [currentMonth, setCurrentMonth] = createSignal(props.value.getMonth());
  const [currentYear, setCurrentYear] = createSignal(props.value.getFullYear());
  const [showMonthPicker, setShowMonthPicker] = createSignal(false);
  const [showYearPicker, setShowYearPicker] = createSignal(false);
  let pickerRef: HTMLDivElement | undefined;

  // Memoize number formatting
  const formatNumber = createMemo(() => {
    const savedLang = localStorage.getItem("sc_lang") || "en_us";
    return (num: number) =>
      new Intl.NumberFormat(savedLang.replace("_", "-"), {
        minimumIntegerDigits: 1,
        useGrouping: false,
      }).format(num);
  });

  // Memoize months and weekdays to prevent unnecessary re-renders
  const months = createMemo(() => [
    t("components.datePicker.months.january"),
    t("components.datePicker.months.february"),
    t("components.datePicker.months.march"),
    t("components.datePicker.months.april"),
    t("components.datePicker.months.may"),
    t("components.datePicker.months.june"),
    t("components.datePicker.months.july"),
    t("components.datePicker.months.august"),
    t("components.datePicker.months.september"),
    t("components.datePicker.months.october"),
    t("components.datePicker.months.november"),
    t("components.datePicker.months.december"),
  ]);

  const weekDays = createMemo(() => [
    t("components.datePicker.weekDays.sunday"),
    t("components.datePicker.weekDays.monday"),
    t("components.datePicker.weekDays.tuesday"),
    t("components.datePicker.weekDays.wednesday"),
    t("components.datePicker.weekDays.thursday"),
    t("components.datePicker.weekDays.friday"),
    t("components.datePicker.weekDays.saturday"),
  ]);

  // Memoize format date to prevent unnecessary recalculations
  const formatDate = createMemo(() => {
    const numberFormatter = formatNumber();
    return (date: Date) => {
      const day = numberFormatter(date.getDate());
      const month = months()[date.getMonth()];
      const year = numberFormatter(date.getFullYear());
      return t("components.datePicker.dateFormat", { month, day, year });
    };
  });

  // Memoize years list
  const years = createMemo(() =>
    Array.from({ length: 124 }, (_, i) => new Date().getFullYear() - i),
  );

  // Memoize click outside handler
  const handleClickOutside = (event: MouseEvent) => {
    if (pickerRef && !pickerRef.contains(event.target as Node)) {
      setIsOpen(false);
      setShowMonthPicker(false);
      setShowYearPicker(false);
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() =>
      document.removeEventListener("mousedown", handleClickOutside),
    );
  });

  // Optimize date calculations
  const getDaysInMonth = (month: number, year: number) =>
    new Date(year, month + 1, 0).getDate();

  const getFirstDayOfMonth = (month: number, year: number) =>
    new Date(year, month, 1).getDay();

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentYear(), currentMonth(), day);
    const minDate = props.minDate || new Date(1900, 0, 1);
    const maxDate = props.maxDate || new Date();

    if (newDate >= minDate && newDate <= maxDate) {
      const utcDate = new Date(
        Date.UTC(
          newDate.getFullYear(),
          newDate.getMonth(),
          newDate.getDate(),
          0,
          0,
          0,
        ),
      );

      setSelectedDate(newDate);
      props.onChange(newDate, utcDate.toISOString());
      setIsOpen(false);
    }
  };

  // Optimize event handlers to prevent default and stop propagation
  const handleMonthSelect = (monthIndex: number, e?: Event) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setCurrentMonth(monthIndex);
    setShowMonthPicker(false);
  };

  const handleYearSelect = (year: number, e?: Event) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setCurrentYear(year);
    setShowYearPicker(false);
  };

  const toggleMonthPicker = (e?: Event) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setShowMonthPicker(!showMonthPicker());
    setShowYearPicker(false);
  };

  const toggleYearPicker = (e?: Event) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setShowYearPicker(!showYearPicker());
    setShowMonthPicker(false);
  };

  const handlePrevMonth = (e?: Event) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (currentMonth() === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e?: Event) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (currentMonth() === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  // Memoize calendar days calculation
  const getCalendarDays = createMemo(() => {
    const daysInMonth = getDaysInMonth(currentMonth(), currentYear());
    const firstDay = getFirstDayOfMonth(currentMonth(), currentYear());
    const days: { type: "empty" | "day"; value?: number }[] = [];

    for (let i = 0; i < firstDay; i++) {
      days.push({ type: "empty" });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ type: "day", value: day });
    }

    // Pad with empty days to always have 6 rows (42 days)
    const totalSlots = 42;
    const remaining = totalSlots - days.length;
    for (let i = 0; i < remaining; i++) {
      days.push({ type: "empty" });
    }

    return days;
  });

  return (
    <div ref={pickerRef} class={`relative ${props.class || ""}`}>
      <div
        onClick={() => setIsOpen(!isOpen())}
        class="w-full px-4 py-2 border border-border rounded-md cursor-pointer 
          bg-[#323857] text-text-primary focus:outline-none 
          focus:border-accent dark:border-border"
      >
        {formatDate()(selectedDate())}
      </div>

      <Portal>
        <Show when={isOpen()}>
          <div
            ref={pickerRef}
            class="fixed z-[1000] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full sm:w-96 max-w-[calc(100vw-2rem)] p-3 border rounded-lg shadow-lg
              bg-[#1B1B26] border-border dark:border-border
              animate-in fade-in slide-in-from-top-2"
          >
            <div class="flex items-center justify-between mb-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                class="p-1 rounded-full hover:bg-surface dark:hover:bg-surface-dark
                  transition-transform hover:scale-110 active:scale-95"
              >
                <svg
                  class="w-6 h-6 text-text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <div class="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={toggleMonthPicker}
                  class="text-lg font-semibold hover:text-accent text-text-primary px-2 py-1 rounded
                    hover:bg-surface dark:hover:bg-surface-dark transition-colors"
                  title={t("components.datePicker.selectMonth")}
                >
                  {months()[currentMonth()]}
                </button>
                <button
                  type="button"
                  onClick={toggleYearPicker}
                  class="text-lg font-semibold hover:text-accent text-text-primary px-2 py-1 rounded
                    hover:bg-surface dark:hover:bg-surface-dark transition-colors"
                  title={t("components.datePicker.selectYear")}
                >
                  {formatNumber()(currentYear())}
                </button>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                class="p-1 rounded-full hover:bg-surface dark:hover:bg-surface-dark
                  transition-transform hover:scale-110 active:scale-95"
              >
                <svg
                  class="w-6 h-6 text-text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            <Show when={!showMonthPicker() && !showYearPicker()}>
              <div class="grid grid-cols-7 gap-1 mb-2">
                <For each={weekDays()}>
                  {(day) => (
                    <div class="w-12 h-8 flex items-center justify-center text-sm font-semibold text-text-secondary">
                      {day}
                    </div>
                  )}
                </For>
              </div>

              <div class="grid grid-cols-7 gap-1">
                <For each={getCalendarDays()}>
                  {(day) => {
                    if (day.type === "empty") {
                      return <div class="w-11 h-9" />;
                    }

                    const date = new Date(
                      currentYear(),
                      currentMonth(),
                      day.value!,
                    );
                    const minDate = props.minDate || new Date(1900, 0, 1);
                    const maxDate = props.maxDate || new Date();
                    const isDisabled = date < minDate || date > maxDate;
                    const isSelected =
                      selectedDate() &&
                      date.getDate() === selectedDate().getDate() &&
                      date.getMonth() === selectedDate().getMonth() &&
                      date.getFullYear() === selectedDate().getFullYear();

                    return (
                      <button
                        type="button"
                        onClick={() =>
                          !isDisabled && handleDateSelect(day.value!)
                        }
                        class={`w-12 h-7 rounded-full flex items-center justify-center text-sm transition-transform
                          ${isSelected ? "bg-[#323857] text-white" : "hover:bg-surface dark:hover:bg-surface-dark text-text-primary"}
                          ${isDisabled ? "text-text-disabled cursor-not-allowed" : "cursor-pointer hover:scale-110 active:scale-95"}
                        `}
                        disabled={isDisabled}
                      >
                        {formatNumber()(day.value!)}
                      </button>
                    );
                  }}
                </For>
              </div>
            </Show>

            <Show when={showMonthPicker()}>
              <div class="grid grid-cols-3 gap-2">
                <For each={months()}>
                  {(month, index) => (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleMonthSelect(index());
                      }}
                      class={`p-1 rounded-md text-sm transition-colors
                        ${currentMonth() === index() ? "bg-accent text-white" : "hover:bg-surface dark:hover:bg-surface-dark text-text-primary"}
                      `}
                    >
                      {month}
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <Show when={showYearPicker()}>
              <div class="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-surface">
                <For each={years()}>
                  {(year) => (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleYearSelect(year);
                      }}
                      class={`p-1 rounded-md text-sm transition-colors
                        ${currentYear() === year ? "bg-accent text-white" : "hover:bg-surface dark:hover:bg-surface-dark text-text-primary"}
                      `}
                    >
                      {formatNumber()(year)}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </Portal>
    </div>
  );
};

export default DatePicker;