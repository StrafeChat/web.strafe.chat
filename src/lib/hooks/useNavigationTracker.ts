import { createEffect } from "solid-js";
import { useLocation } from "@solidjs/router";
import { useNavigationHistory } from "../providers/navigation/NavigationHistoryProvider";

/**
 * Hook that automatically tracks navigation changes and updates history
 * Must be used within a Router context
 */
export const useNavigationTracker = () => {
  const location = useLocation();
  const { updateHistory } = useNavigationHistory();

  // Track location changes and update history
  createEffect(() => {
    const pathname = location.pathname;
    updateHistory(pathname);
  });
};