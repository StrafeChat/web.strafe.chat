import { Component, JSX, Show, createSignal } from "solid-js";
import { Portal } from "solid-js/web";

interface TooltipProps {
  content: string;
  position?: "top" | "right" | "bottom";
  children: JSX.Element;
  class?: string;
}

export const Tooltip: Component<TooltipProps> = (props) => {
  const [isVisible, setIsVisible] = createSignal(false);
  const [tooltipPosition, setTooltipPosition] = createSignal({
    top: 0,
    left: 0,
    stemPosition: "center",
  });

  const updatePosition = (targetElement: HTMLElement) => {
    // Get the first child element since that's the actual element we want to position against
    const actualElement = targetElement.children[0] as HTMLElement;
    if (!actualElement) return;

    const rect = actualElement.getBoundingClientRect();
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const viewportWidth = window.innerWidth;
    const gap = 12;

    // Make tooltip visible but hidden to measure its dimensions
    setIsVisible(true);
    requestAnimationFrame(() => {
      const tooltip = document.querySelector("[data-tooltip]") as HTMLElement;
      if (!tooltip) return;

      // Hide tooltip while measuring
      tooltip.style.visibility = 'hidden';

      const tooltipWidth = tooltip.offsetWidth;
      const tooltipHeight = tooltip.offsetHeight;
      let left = rect.left + scrollLeft;
      let top = rect.top + scrollTop;
      let stemPosition = "center";

      if (props.position === "right") {
        left = rect.right + scrollLeft + gap;
        top = rect.top + scrollTop + rect.height / 2;

        if (rect.right + tooltipWidth + gap > viewportWidth) {
          left = rect.left - tooltipWidth - gap;
          stemPosition = "right";
        } else {
          stemPosition = "left";
        }

        top = top - tooltipHeight / 2;
      } else if (props.position === "bottom") {
        top = rect.bottom + scrollTop + gap;

        left = rect.left + scrollLeft + rect.width / 2 - tooltipWidth / 2;
        stemPosition = "center";

        if (left + tooltipWidth > viewportWidth) {
          left = viewportWidth - tooltipWidth - gap;
          stemPosition = "right";
        } else if (left < gap) {
          left = gap;
          stemPosition = "left";
        }
      } else {
        // Default to top
        top = rect.top + scrollTop - tooltipHeight - gap;

        left = rect.left + scrollLeft + rect.width / 2 - tooltipWidth / 2;
        stemPosition = "center";

        if (left + tooltipWidth > viewportWidth) {
          left = viewportWidth - tooltipWidth - gap;
          stemPosition = "right";
        } else if (left < gap) {
          left = gap;
          stemPosition = "left";
        }
      }

      setTooltipPosition({ top, left, stemPosition });
      // Show tooltip after positioning
      tooltip.style.visibility = 'visible';
    });
  };

  const getPositionClasses = () => {
    switch (props.position) {
      case "right":
        return "";
      case "bottom":
        return "";
      default: // top
        return "";
    }
  };

  const getArrowClasses = () => {
    const position = tooltipPosition().stemPosition;
    const baseClasses = "absolute border-[8px]";

    switch (props.position) {
      case "right":
        return `${baseClasses} left-[-16px] ${
          position === "center"
            ? "top-1/2 -translate-y-1/2"
            : position === "left"
            ? "top-[10px]"
            : "bottom-[10px]"
        } border-r-[var(--surface)] border-y-transparent border-l-transparent`;
      case "bottom":
        return `${baseClasses} top-[-16px] ${
          position === "center"
            ? "left-1/2 -translate-x-1/2"
            : position === "left"
            ? "left-[10px]"
            : "right-[10px]"
        } border-b-[var(--surface)] border-x-transparent border-t-transparent`;
      default: // top
        return `${baseClasses} bottom-[-16px] ${
          position === "center"
            ? "left-1/2 -translate-x-1/2"
            : position === "left"
            ? "left-[10px]"
            : "right-[10px]"
        } border-t-[var(--surface)] border-x-transparent border-b-transparent`;
    }
  };

  return (
    <>
      <span
        class={`contents ${props.class || ""}`}
        onMouseEnter={(e) => updatePosition(e.currentTarget)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {props.children}
      </span>
      <Show when={isVisible()}>
        <Portal>
          <div
            data-tooltip
            class={`fixed z-50 px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] bg-[var(--surface)] border border-[var(--border)] rounded shadow-[var(--md)] pointer-events-none ${getPositionClasses()}`}
            style={{
              top: `${tooltipPosition().top}px`,
              left: `${tooltipPosition().left}px`,
              visibility: 'hidden', // Start hidden
            }}
          >
            {props.content}
            <div class={getArrowClasses()} />
          </div>
        </Portal>
      </Show>
    </>
  );
};
