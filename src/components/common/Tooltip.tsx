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
    stemPosition: 'center'
  });

  const updatePosition = (targetElement: HTMLElement) => {
    const rect = targetElement.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const viewportWidth = window.innerWidth;
    const gap = 12; // Increased gap between tooltip and target element

    // We need to render the tooltip first to get its width
    setIsVisible(true);
    setTimeout(() => {
      const tooltip = document.querySelector('[data-tooltip]') as HTMLElement;
      if (!tooltip) return;
      
      const tooltipWidth = tooltip.offsetWidth;
      const tooltipHeight = tooltip.offsetHeight;
      let left = rect.left + scrollLeft;
      let top = rect.top + scrollTop;
      let stemPosition = 'center'; // can be 'left', 'center', or 'right'

      if (props.position === "right") {
        left = rect.right + scrollLeft + gap;
        top = rect.top + scrollTop + (rect.height / 2) - (tooltipHeight / 2);
        
        if (rect.right + tooltipWidth + gap > viewportWidth) {
          left = rect.left - tooltipWidth - gap;
          stemPosition = 'right';
        } else {
          stemPosition = 'left';
        }
      } else if (props.position === "bottom") {
        top = rect.bottom + scrollTop + gap;
        
        left = rect.left + scrollLeft + (rect.width / 2) - (tooltipWidth / 2);
        stemPosition = 'center';
        
        if (left + tooltipWidth > viewportWidth) {
          left = viewportWidth - tooltipWidth - gap;
          stemPosition = 'right';
        } else if (left < gap) {
          left = gap;
          stemPosition = 'left';
        }
      } else {
        // Default to top
        top = rect.top + scrollTop - tooltipHeight - gap;
        
        left = rect.left + scrollLeft + (rect.width / 2) - (tooltipWidth / 2);
        stemPosition = 'center';
        
        if (left + tooltipWidth > viewportWidth) {
          left = viewportWidth - tooltipWidth - gap;
          stemPosition = 'right';
        } else if (left < gap) {
          left = gap;
          stemPosition = 'left';
        }
      }

      setTooltipPosition({ top, left, stemPosition });
    }, 0);
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
          position === 'center' ? 'top-1/2 -translate-y-1/2' : 
          position === 'left' ? 'top-[10px]' : 'bottom-[10px]'
        } border-r-[var(--surface)] border-y-transparent border-l-transparent`;
      case "bottom":
        return `${baseClasses} top-[-16px] ${
          position === 'center' ? 'left-1/2 -translate-x-1/2' : 
          position === 'left' ? 'left-[10px]' : 'right-[10px]'
        } border-b-[var(--surface)] border-x-transparent border-t-transparent`;
      default: // top
        return `${baseClasses} bottom-[-16px] ${
          position === 'center' ? 'left-1/2 -translate-x-1/2' : 
          position === 'left' ? 'left-[10px]' : 'right-[10px]'
        } border-t-[var(--surface)] border-x-transparent border-b-transparent`;
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
            data-tooltip
            class={`fixed z-50 px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] bg-[var(--surface)] border border-[var(--border)] rounded shadow-[var(--md)] pointer-events-none ${getPositionClasses()} ${
              props.class || ""
            }`}
            style={{
              top: `${tooltipPosition().top}px`,
              left: `${tooltipPosition().left}px`,
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
