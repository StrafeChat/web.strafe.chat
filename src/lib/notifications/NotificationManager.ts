export class NotificationManager {
  private static instance: NotificationManager;
  private registration: ServiceWorkerRegistration | null = null;

  private constructor() {}

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  async init() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Notifications] Push notifications not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      console.log('[Notifications] Service Worker registered');
      return true;
    } catch (error) {
      console.error('[Notifications] Service Worker registration failed:', error);
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('[Notifications] Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('[Notifications] Permission request failed:', error);
      return false;
    }
  }

  async subscribeToPush(serverPublicKey: string): Promise<PushSubscription | null> {
    if (!this.registration) {
      console.warn('[Notifications] Service Worker not registered');
      return null;
    }

    try {
      let subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        return subscription;
      }

      subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: serverPublicKey
      });

      console.log('[Notifications] Push subscription successful:', subscription);
      return subscription;
    } catch (error) {
      console.error('[Notifications] Push subscription failed:', error);
      return null;
    }
  }

  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Notifications] Unsubscribe failed:', error);
      return false;
    }
  }
}
