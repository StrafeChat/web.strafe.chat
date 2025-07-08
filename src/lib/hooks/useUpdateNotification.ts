import { createSignal, onMount } from "solid-js";
import { githubService, type UpdateInfo } from "../services/githubService";
import { APP_VERSION } from "../../constants";

const STORAGE_KEY = 'strafe_chat_shown_updates';
const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

interface ShownUpdate {
  version: string;
  type: 'commit';
  timestamp: number;
}

export const useUpdateNotification = () => {
  const [updateInfo, setUpdateInfo] = createSignal<UpdateInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [isChecking, setIsChecking] = createSignal(false);

  /**
   * Get shown updates from localStorage
   */
  const getShownUpdates = (): ShownUpdate[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  /**
   * Mark an update as shown
   */
  const markUpdateAsShown = (update: UpdateInfo) => {
    try {
      const shownUpdates = getShownUpdates();
      const newUpdate: ShownUpdate = {
        version: update.version,
        type: update.type,
        timestamp: Date.now()
      };
      
      // Add new update and keep only last 10 entries
      shownUpdates.push(newUpdate);
      const trimmed = shownUpdates.slice(-10);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Failed to save shown update:', error);
    }
  };

  /**
   * Check if an update has already been shown
   */
  const hasUpdateBeenShown = (update: UpdateInfo): boolean => {
    const shownUpdates = getShownUpdates();
    return shownUpdates.some(
      shown => shown.version === update.version && shown.type === update.type
    );
  };

  /**
   * Check for updates from GitHub
   */
  const checkForUpdates = async (showModal = true) => {
    if (isChecking()) return;
    
    setIsChecking(true);
    
    try {
      console.log('Checking for updates...');
      const update = await githubService.checkForUpdates(APP_VERSION);
      
      if (update) {
        console.log('Update found:', update);
        
        // Check if we've already shown this update
        if (!hasUpdateBeenShown(update)) {
          setUpdateInfo(update);
          
          if (showModal) {
            setIsModalOpen(true);
          }
          
          return update;
        } else {
          console.log('Update already shown to user');
        }
      } else {
        console.log('No updates available');
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setIsChecking(false);
    }
    
    return null;
  };

  /**
   * Handle modal close
   */
  const handleModalClose = () => {
    const current = updateInfo();
    if (current) {
      markUpdateAsShown(current);
    }
    setIsModalOpen(false);
    setUpdateInfo(null);
  };

  /**
   * Initialize update checking on mount
   */
  onMount(() => {
    // Check for updates on app start (with a small delay)
    setTimeout(() => {
      checkForUpdates(true);
    }, 2000);

    // Set up periodic checking
    const interval = setInterval(() => {
      checkForUpdates(false); // Don't show modal for periodic checks
    }, CHECK_INTERVAL);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  });

  return {
    updateInfo,
    isModalOpen,
    isChecking,
    checkForUpdates,
    handleModalClose,
    // Expose for manual testing
    clearShownUpdates: () => {
      localStorage.removeItem(STORAGE_KEY);
      console.log('Cleared shown updates cache');
    }
  };
};