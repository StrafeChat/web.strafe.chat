import { Component, createEffect, onCleanup } from "solid-js";
import { useModal } from "../../lib/providers/modal/ModalProvider";
import { useContextMenu } from "../../lib/providers/context/ContextMenuProvider";
import { useSettings } from "../../lib/providers/settings/SettingsProvider";

const GlobalKeyboardHandler: Component = () => {
  const modal = useModal();
  const contextMenu = useContextMenu();
  const settings = useSettings();

  createEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if any interactive elements are active
      if (
        modal.isOpen ||
        contextMenu.isOpen ||
        settings.state.isOpen
      ) {
        return;
      }

      // Check for visible overlays (dropdowns, modals, popups, tooltips)
      const overlaySelectors = [
        // ARIA roles for accessibility
        '[role="dialog"]:not([style*="display: none"]):not([style*="display:none"])',
        '[role="menu"]:not([style*="display: none"]):not([style*="display:none"])',
        '[role="listbox"]:not([style*="display: none"]):not([style*="display:none"])',
        '[role="tooltip"]:not([style*="display: none"]):not([style*="display:none"])',
        // Generic overlay classes
        '.modal:not(.hidden):not([style*="display: none"])',
        '.popup:not(.hidden):not([style*="display: none"])',
        '.dropdown:not(.hidden):not([style*="display: none"])',
        '.popover:not(.hidden):not([style*="display: none"])',
        // State-based selectors
        '[data-state="open"]',
        '[aria-expanded="true"]'
      ];
      
      // Specific selectors for our app's overlay patterns
      const specificOverlaySelectors = [
        // Modal backdrop (fixed inset-0 z-50)
        '.fixed.inset-0.z-50',
        // UserPopupMenu and similar popups (fixed z-50 with specific dimensions)
        '.fixed.z-50.bg-background2.rounded-lg.shadow-lg',
        // Dropdown menus (absolute with z-50 and shadow)
        '.absolute.z-50.shadow-lg',
        // Any fixed positioned element with z-50 that has content
        '.fixed.z-50[style*="left:"][style*="top:"]'
      ];
      
      const hasVisibleOverlay = [...overlaySelectors, ...specificOverlaySelectors].some(selector => {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).some(el => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          
          // Basic visibility check
          const isVisible = style.display !== 'none' && 
                           style.visibility !== 'hidden' && 
                           style.opacity !== '0';
          
          // For specific overlay selectors, also check dimensions
          if (specificOverlaySelectors.includes(selector)) {
            return isVisible && rect.width > 0 && rect.height > 0;
          }
          
          return isVisible;
        });
      });
      
      if (hasVisibleOverlay) {
        return;
      }

      // Don't handle if we're not in a chat context (rooms or spaces)
      const pathname = window.location.pathname;
      const isInChat = pathname.includes('/rooms/') || pathname.includes('/spaces/');
      if (!isInChat) {
        return;
      }

      // Don't handle special keys, modifiers, or function keys
      if (
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.key.length > 1 || // Excludes keys like 'Enter', 'Escape', 'ArrowUp', etc.
        event.key === ' ' // Don't auto-focus on spacebar to avoid interfering with shortcuts
      ) {
        return;
      }

      // Check if an input, textarea, or contenteditable element is already focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement &&
        (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true' ||
          activeElement.closest('[contenteditable="true"]')
        );

      // If an input is already focused, let it handle the typing normally
      // DO NOT intercept or modify the typing behavior
      if (isInputFocused) {
        return;
      }

      // Find the chat input element
      const chatInput = document.querySelector('[data-placeholder]') as HTMLDivElement;
      if (!chatInput) {
        return;
      }

      // Only focus the chat input, don't interfere with typing
      // Let the normal input handling take care of the character input
      chatInput.focus();
      
      // Don't prevent default - let the normal input handling work
      // The focus will cause the next keystroke to be handled normally by the input
    };

    // Add the event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  // This component doesn't render anything
  return null;
};

export default GlobalKeyboardHandler;