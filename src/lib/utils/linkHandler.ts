// Simple link handler that serves as a compatibility layer
// The actual functionality has been moved to the LinkConfirmationHandler component
// which provides a custom modal instead of the browser's built-in confirm dialog

// IMPORTANT: This handler is completely disabled to prevent duplicate modals
// All link handling is now done by the LinkConfirmationHandler component

export function setupLinkHandler() {
  // This function is completely disabled to prevent duplicate modals
  console.log("Link handler is completely disabled. Using LinkConfirmationHandler component instead.");
  
  // DO NOT add any event listeners here - they would conflict with LinkConfirmationHandler
}