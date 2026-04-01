import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { Portal } from 'solid-js/web';

interface TooltipProps {
  label: string;
  children: import('solid-js').JSX.Element;
  side?: 'right' | 'left' | 'top';
  /** When true, wrapper does not take full width (e.g. for icon rows). */
  inline?: boolean;
}

export const Tooltip: Component<TooltipProps> = (props) => {
  const [show, setShow] = createSignal(false);
  const [pos, setPos] = createSignal({ top: 0, left: 0 });
  let triggerEl: HTMLElement | undefined;

  function updatePosition() {
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const gap = props.side === 'top' ? 18 : 8;
    const tooltipHeight = 28;
    if (props.side === 'top') {
      setPos({
        top: rect.top - tooltipHeight - gap,
        left: rect.left + rect.width / 2,
      });
    } else {
      const centerY = rect.top + rect.height / 2 - tooltipHeight / 2 - 4;
      if (props.side === 'left') {
        setPos({ top: centerY, left: rect.left - gap });
      } else {
        setPos({ top: centerY, left: rect.right + gap });
      }
    }
  }

  function handleMouseEnter() {
    setShow(true);
    requestAnimationFrame(updatePosition);
  }

  function handleMouseLeave() {
    setShow(false);
  }

  const isLeft = props.side === 'left';
  const isTop = props.side === 'top';

  const transform =
    isTop ? 'translateX(-50%)' : isLeft ? 'translateX(-100%)' : 'none';

  return (
    <div
      ref={(el) => { triggerEl = el; }}
      class={props.inline ? 'inline-flex' : 'w-full flex justify-center'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {props.children}
      <Show when={show()}>
        <Portal>
          <div
            class="fixed z-[100] flex items-center pointer-events-none"
            style={{
              top: `${pos().top}px`,
              left: `${pos().left}px`,
              transform,
            }}
          >
            <div class="relative flex items-center whitespace-nowrap rounded-md border border-border bg-popover/95 px-3 py-2 text-sm font-medium text-popover-foreground shadow-2xl shadow-black/40 backdrop-blur-xl">
              {isTop ? (
                <div
                  class="absolute left-1/2 top-full -mt-px h-0 w-0 -translate-x-1/2 border-x-[6px] border-x-transparent border-t-[6px] border-t-popover"
                />
              ) : (
                <div
                  class={`absolute top-1/2 h-0 w-0 -translate-y-1/2 border-y-[6px] border-y-transparent ${
                    isLeft
                      ? 'left-full border-l-[6px] border-l-popover'
                      : 'right-full border-r-[6px] border-r-popover'
                  }`}
                />
              )}
              {props.label}
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
