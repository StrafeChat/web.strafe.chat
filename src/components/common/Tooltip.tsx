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
  });

  const updatePosition = (targetElement: HTMLElement) => {
    const rect = targetElement.getBoundingClientRect();
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (props.position === "right") {
      setTooltipPosition({
        top: rect.top + scrollTop + rect.height / 2,
        left: rect.right + scrollLeft + 8,
      });
    } else if (props.position === "bottom") {
      setTooltipPosition({
        top: rect.bottom + scrollTop + 8,
        left: rect.left + scrollLeft + rect.width / 2,
      });
    } else {
      // Default to top
      setTooltipPosition({
        top: rect.top + scrollTop - 8,
        left: rect.left + scrollLeft + rect.width / 2,
      });
    }
  };

  const handleMouseEnter = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    updatePosition(target);
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const getPositionClasses = () => {
    switch (props.position) {
      case "right":
        return "-translate-y-1/2";
      case "bottom":
        return "-translate-x-1/2";
      default: // top
        return "-translate-x-1/2 -translate-y-full";
    }
  };

  const getArrowClasses = () => {
    switch (props.position) {
      case "right":
        return "left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-r-gray-900 border-y-transparent border-l-transparent";
      case "bottom":
        return "left-1/2 top-0 -translate-x-1/2 -translate-y-1 border-b-gray-900 border-x-transparent border-t-transparent";
      default: // top
        return "left-1/2 top-full -translate-x-1/2 -translate-y-1 border-t-gray-900 border-x-transparent border-b-transparent";
    }
  };

  return (
    <>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        class="relative inline-block"
      >
        {props.children}
      </div>
      <Show when={isVisible()}>
        <Portal>
          <div
            class={`fixed z-50 px-2 py-1 text-sm font-medium text-white bg-gray-900 rounded shadow-lg pointer-events-none transform ${getPositionClasses()} ${
              props.class || ""
            }`}
            style={{
              top: `${tooltipPosition().top}px`,
              left: `${tooltipPosition().left}px`,
              "max-width": "200px",
            }}
          >
            {props.content}
            <div class={`absolute border-[5px] ${getArrowClasses()}`} />
          </div>
        </Portal>
      </Show>
    </>
  );
};
