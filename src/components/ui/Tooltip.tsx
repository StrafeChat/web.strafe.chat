import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { Portal } from 'solid-js/web';

interface TooltipProps {
  label: string;
  children: import('solid-js').JSX.Element;
  side?: 'right' | 'left';
}

export const Tooltip: Component<TooltipProps> = (props) => {
  const [show, setShow] = createSignal(false);
  const [pos, setPos] = createSignal({ top: 0, left: 0 });
  let triggerEl: HTMLElement | undefined;

  function updatePosition() {
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const gap = 8;
    const tooltipHeight = 28;
    const centerY = rect.top + rect.height / 2 - tooltipHeight / 2 - 4;
    if (props.side === 'left') {
      setPos({ top: centerY, left: rect.left - gap });
    } else {
      setPos({ top: centerY, left: rect.right + gap });
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

  return (
    <div
      ref={(el) => { triggerEl = el; }}
      class="w-full flex justify-center"
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
              transform: isLeft ? 'translateX(-100%)' : 'none',
            }}
          >
            <div class="relative flex items-center px-3 py-2 rounded-md bg-[hsl(0_0%_14%)] text-white text-sm font-medium whitespace-nowrap shadow-xl">
              {/* Arrow pointing towards trigger (left when tooltip is right, right when tooltip is left) */}
              <div
                class={`absolute top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent ${
                  isLeft
                    ? 'left-full border-l-[6px] border-l-[hsl(0_0%_14%)]'
                    : 'right-full border-r-[6px] border-r-[hsl(0_0%_14%)]'
                }`}
              />
              {props.label}
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
