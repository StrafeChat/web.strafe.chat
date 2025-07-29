// Removed unused audioManager import

export interface NotificationSettings {
  enableSounds: boolean;
  enablePushNotifications: boolean;
  enableDesktopNotifications: boolean;
  soundVolume: number;
  mentionSound: string;
  messageSound: string;
  muteAllSounds: boolean;
  onlyMentionsAndPMs: boolean;
  respectDndStatus: boolean;
}

export interface NotificationData {
  type: 'mention' | 'message' | 'pm';
  title: string;
  body: string;
  icon?: string;
  roomId: string;
  spaceId?: string;
  userId?: string;
  url?: string;
  isMention?: boolean;
  isDM?: boolean;
}

export interface UserPresence {
  status: 'online' | 'idle' | 'dnd' | 'offline';
}

class NotificationService {
  private static instance: NotificationService;
  private soundCache: Map<string, HTMLAudioElement> = new Map();
  private isDocumentVisible: boolean = true;
  private isWindowFocused: boolean = true;

  private constructor() {
    this.setupVisibilityListeners();
    this.preloadSounds();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Setup document visibility and window focus listeners
   */
  private setupVisibilityListeners(): void {
    // Document visibility
    document.addEventListener('visibilitychange', () => {
      this.isDocumentVisible = !document.hidden;
    });

    // Window focus
    window.addEventListener('focus', () => {
      this.isWindowFocused = true;
    });

    window.addEventListener('blur', () => {
      this.isWindowFocused = false;
    });
  }

  /**
   * Preload notification sounds
   */
  private preloadSounds(): void {
    const sounds = {
      mention: '/sounds/message.wav',
      message: '/sounds/message.wav',
      pm: '/sounds/message.wav'
    };

    Object.entries(sounds).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.volume = 0.7; // Default volume
      this.soundCache.set(key, audio);
    });
  }

  /**
   * Check if notifications should be shown based on user presence and settings
   */
  private shouldShowNotification(
    settings: NotificationSettings,
    userPresence: UserPresence,
    notificationData: NotificationData
  ): boolean {
    // Respect DND status if enabled in settings
    if (settings.respectDndStatus && userPresence.status === 'dnd') {
      return false;
    }

    // If only mentions and PMs are enabled, filter accordingly
    if (settings.onlyMentionsAndPMs) {
      return !!(notificationData.isMention || notificationData.isDM);
    }

    return true;
  }

  /**
   * Check if sounds should be played
   */
  private shouldPlaySound(
    settings: NotificationSettings,
    userPresence: UserPresence,
    notificationData: NotificationData
  ): boolean {
    if (!settings.enableSounds || settings.muteAllSounds) {
      return false;
    }

    // Respect DND status for sounds
    if (settings.respectDndStatus && userPresence.status === 'dnd') {
      return false;
    }

    // Don't play sounds if window is focused and document is visible
    // (user is actively using the app)
    if (this.isWindowFocused && this.isDocumentVisible) {
      return false;
    }

    // If only mentions and PMs are enabled, filter accordingly
    if (settings.onlyMentionsAndPMs) {
      return !!(notificationData.isMention || notificationData.isDM);
    }

    return true;
  }

  /**
   * Play notification sound
   */
  private async playSound(
    soundType: string,
    volume: number
  ): Promise<void> {
    try {
      const audio = this.soundCache.get(soundType);
      if (!audio) {
        console.warn(`[NotificationService] Sound not found: ${soundType}`);
        return;
      }

      // Clone the audio to allow multiple simultaneous plays
      const audioClone = audio.cloneNode() as HTMLAudioElement;
      audioClone.volume = Math.max(0, Math.min(1, volume));
      
      await audioClone.play();
    } catch (error) {
      console.warn('[NotificationService] Failed to play sound:', error);
    }
  }

  /**
   * Show desktop notification
   */
  private async showDesktopNotification(
    notificationData: NotificationData
  ): Promise<void> {
    try {
      if (!('Notification' in window)) {
        console.warn('[NotificationService] Browser does not support notifications');
        return;
      }

      if (Notification.permission !== 'granted') {
        console.warn('[NotificationService] Notification permission not granted');
        return;
      }

      const notification = new Notification(notificationData.title, {
        body: notificationData.body,
        icon: notificationData.icon || '/favicon.ico',
        tag: `strafe-${notificationData.roomId}`, // Prevent duplicate notifications
        requireInteraction: false,
        silent: true // We handle sounds separately
      });

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        if (notificationData.url) {
          window.location.href = notificationData.url;
        }
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

    } catch (error) {
      console.warn('[NotificationService] Failed to show desktop notification:', error);
    }
  }

  /**
   * Send push notification via service worker
   */
  private async sendPushNotification(
    notificationData: NotificationData
  ): Promise<void> {
    try {
      // This would typically be handled by the backend
      // For now, we'll use the existing NotificationManager
      console.log('[NotificationService] Push notification would be sent:', notificationData);
    } catch (error) {
      console.warn('[NotificationService] Failed to send push notification:', error);
    }
  }

  /**
   * Main method to handle all types of notifications
   */
  public async notify(
    notificationData: NotificationData,
    settings: NotificationSettings,
    userPresence: UserPresence
  ): Promise<void> {
    try {
      // Determine sound type based on notification type
      let soundType = settings.messageSound;
      if (notificationData.isMention) {
        soundType = settings.mentionSound;
      } else if (notificationData.isDM) {
        soundType = 'pm';
      }

      // Play sound if conditions are met
      if (this.shouldPlaySound(settings, userPresence, notificationData)) {
        await this.playSound(soundType, settings.soundVolume);
      }

      // Show desktop notification if conditions are met
      if (
        settings.enableDesktopNotifications &&
        this.shouldShowNotification(settings, userPresence, notificationData) &&
        (!this.isWindowFocused || !this.isDocumentVisible)
      ) {
        await this.showDesktopNotification(notificationData);
      }

      // Send push notification if conditions are met
      if (
        settings.enablePushNotifications &&
        this.shouldShowNotification(settings, userPresence, notificationData) &&
        (!this.isWindowFocused || !this.isDocumentVisible)
      ) {
        await this.sendPushNotification(notificationData);
      }

    } catch (error) {
      console.error('[NotificationService] Failed to send notification:', error);
    }
  }

  /**
   * Request notification permissions
   */
  public async requestPermissions(): Promise<boolean> {
    try {
      if (!('Notification' in window)) {
        console.warn('[NotificationService] Browser does not support notifications');
        return false;
      }

      if (Notification.permission === 'granted') {
        return true;
      }

      if (Notification.permission === 'denied') {
        console.warn('[NotificationService] Notification permission denied');
        return false;
      }

      const permission = await Notification.requestPermission();
      return permission === 'granted';

    } catch (error) {
      console.error('[NotificationService] Failed to request notification permissions:', error);
      return false;
    }
  }

  /**
   * Test notification (for settings)
   */
  public async testNotification(
    settings: NotificationSettings,
    type: 'mention' | 'message' | 'pm' = 'message'
  ): Promise<void> {
    try {
      // For testing, always play sound regardless of focus state
      if (settings.enableSounds && !settings.muteAllSounds) {
        let soundType = 'message';
        if (type === 'mention') {
          soundType = settings.mentionSound || 'mention';
        } else if (type === 'pm') {
        soundType = 'pm';
        } else {
          soundType = settings.messageSound || 'message';
        }
        
        await this.playSound(soundType, settings.soundVolume);
      }
      
      // Also show a test desktop notification if enabled
      if (settings.enableDesktopNotifications && Notification.permission === 'granted') {
        const testData: NotificationData = {
          type,
          title: 'StrafeChat Test',
          body: type === 'mention' ? 'This is a test mention notification' : 
                type === 'pm' ? 'This is a test PM notification' : 
                'This is a test message notification',
          roomId: 'test',
          isMention: type === 'mention',
          isDM: type === 'pm'
        };
        
        await this.showDesktopNotification(testData);
      }
    } catch (error) {
      console.error('[NotificationService] Failed to test notification:', error);
      throw error;
    }
  }

  /**
   * Update sound volume for all cached sounds
   */
  public updateSoundVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.soundCache.forEach(audio => {
      audio.volume = clampedVolume;
    });
  }

  /**
   * Clear all notifications (when user becomes active)
   */
  public clearNotifications(): void {
    // Clear any persistent notifications
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_NOTIFICATIONS'
      });
    }
  }
}

export { NotificationService };
export default NotificationService;