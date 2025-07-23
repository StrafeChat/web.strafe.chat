/**
 * Utility functions for testing the update notification system
 * These functions are available in the browser console for manual testing
 */

import { githubService } from "../services/githubService";
import { APP_VERSION } from "../../constants";

/**
 * Test the update notification system manually
 * Usage in browser console: window.testUpdateNotification()
 */
export const testUpdateNotification = async () => {
  console.log("🔍 Testing update notification system...");
  console.log("Current app version:", APP_VERSION);

  try {
    const updateInfo = await githubService.checkForUpdates(APP_VERSION);

    if (updateInfo) {
      console.log("✅ Update found:", updateInfo);
      return updateInfo;
    } else {
      console.log("ℹ️ No updates available");
      return null;
    }
  } catch (error) {
    console.error("❌ Error checking for updates:", error);
    return null;
  }
};

/**
 * Clear the shown updates cache to test notifications again
 * Usage in browser console: window.clearUpdateCache()
 */
export const clearUpdateCache = () => {
  localStorage.removeItem("sc_shown_updates");
  console.log("🗑️ Cleared update notification cache");
};

/**
 * Simulate a fake update for testing the modal
 * Usage in browser console: window.simulateUpdate()
 */
export const simulateUpdate = () => {
  const fakeUpdate = {
    version: "v1.0.0-test",
    message:
      "This is a test update notification.\n\n• Added new features\n• Fixed bugs\n• Improved performance",
    url: "https://github.com/StrafeChat/web.strafe.chat/releases/tag/v1.0.0-test",
    publishedAt: new Date().toISOString(),
    type: "release" as const,
  };

  console.log("🧪 Simulating update:", fakeUpdate);

  // Trigger a custom event that the app can listen to
  window.dispatchEvent(
    new CustomEvent("test-update-notification", {
      detail: fakeUpdate,
    }),
  );

  return fakeUpdate;
};

/**
 * Get current update cache status
 * Usage in browser console: window.getUpdateCacheStatus()
 */
export const getUpdateCacheStatus = () => {
  try {
    const stored = localStorage.getItem("sc_shown_updates");
    const cache = stored ? JSON.parse(stored) : [];

    console.log("📋 Update cache status:");
    console.log("Total cached updates:", cache.length);
    console.table(cache);

    return cache;
  } catch (error) {
    console.error("❌ Error reading update cache:", error);
    return [];
  }
};

// Make functions available globally for console testing
if (typeof window !== "undefined") {
  (window as any).testUpdateNotification = testUpdateNotification;
  (window as any).clearUpdateCache = clearUpdateCache;
  (window as any).simulateUpdate = simulateUpdate;
  (window as any).getUpdateCacheStatus = getUpdateCacheStatus;

  console.log("🛠️ Update test utilities loaded. Available functions:");
  console.log("- testUpdateNotification(): Test real GitHub API");
  console.log("- clearUpdateCache(): Clear notification cache");
  console.log("- simulateUpdate(): Show test notification");
  console.log("- getUpdateCacheStatus(): View cache contents");
}
