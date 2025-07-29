import { Component, createSignal, Show } from 'solid-js';
import { useTransContext } from '@mbarzda/solid-i18next';
import { useUserSettings } from '../../../lib/providers/userSettings/UserSettingsProvider';
import { NotificationService } from '../../../lib/services/NotificationService';
import Bell from '../../shared/icons/Bell';

const NotificationSettings: Component = () => {
  const [t] = useTransContext();
  const { notifications, updateNotificationSettings } = useUserSettings();
  const [isTestingSound, setIsTestingSound] = createSignal(false);
  const [permissionStatus, setPermissionStatus] = createSignal<'granted' | 'denied' | 'default'>('default');

  const notificationService = NotificationService.getInstance();

  // Check current permission status
  const checkPermissionStatus = () => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission as 'granted' | 'denied' | 'default');
    }
  };

  // Initialize permission status
  checkPermissionStatus();

  const handleRequestPermissions = async () => {
    const granted = await notificationService.requestPermissions();
    checkPermissionStatus();
    if (!granted) {
      alert('Notification permissions are required for desktop notifications. Please enable them in your browser settings.');
    }
  };

  const handleTestSound = async (type: 'mention' | 'message' | 'pm') => {
    setIsTestingSound(true);
    try {
      await notificationService.testNotification(notifications(), type);
    } catch (error) {
      console.error('Failed to test notification:', error);
    } finally {
      setTimeout(() => setIsTestingSound(false), 1000);
    }
  };

  const handleVolumeChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const volume = parseFloat(target.value);
    updateNotificationSettings({ soundVolume: volume });
    notificationService.updateSoundVolume(volume);
  };

  return (
    <div class="mb-8">
      {/* Header with Icon */}
      <div class="flex items-center gap-3 mb-6">
        <div class="p-3 bg-primary/10 rounded-lg">
          <Bell />
        </div>
        <div>
          <h2 class="text-xl font-semibold text-text-primary mb-1">
            {t("settings.sections.notifications")}
          </h2>
          <p class="text-text-secondary text-xs">
             Customize your notification preferences
           </p>
        </div>
      </div>

      {/* Notification Settings Section */}
      <div class="bg-background1 rounded-lg p-6 mb-6">
        <div class="flex items-center gap-4 mb-4">
          <div class="p-2 bg-blue-500/10 rounded-lg">
            <Bell />
          </div>
          <h3 class="text-lg font-semibold text-text-primary">Notification Settings</h3>
        </div>
        <div class="bg-background2 rounded-lg p-4">
          <div class="flex flex-col gap-4">
            {/* Desktop Notifications */}
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="space-y-1">
                  <label class="text-base font-medium text-text-primary">Desktop Notifications</label>
                  <p class="text-sm text-text-secondary">Show notifications when the app is not in focus</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    class="sr-only peer"
                    checked={notifications().enableDesktopNotifications}
                    onChange={(e) => updateNotificationSettings({ enableDesktopNotifications: e.target.checked })}
                  />
                  <div class="w-11 h-6 bg-background1 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              
              <Show when={notifications().enableDesktopNotifications && permissionStatus() !== 'granted'}>
                <div class="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <div class="flex items-center justify-between">
                    <div class="space-y-1">
                      <p class="text-sm text-yellow-400 font-medium">Permission Required</p>
                      <p class="text-xs text-yellow-300">Desktop notifications require browser permission</p>
                    </div>
                    <button
                      onClick={handleRequestPermissions}
                      class="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-black text-sm rounded-md transition-colors"
                    >
                      Enable
                    </button>
                  </div>
                </div>
              </Show>
            </div>

            {/* Push Notifications */}
            <div class="flex items-center justify-between">
              <div class="space-y-1">
                <label class="text-base font-medium text-text-primary">Push Notifications</label>
                <p class="text-sm text-text-secondary">Receive notifications even when the app is closed</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  checked={notifications().enablePushNotifications}
                  onChange={(e) => updateNotificationSettings({ enablePushNotifications: e.target.checked })}
                />
                <div class="w-11 h-6 bg-background1 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Sound Settings Section */}
      <div class="bg-background1 rounded-lg p-6 mb-6">
        <div class="flex items-center gap-4 mb-4">
          <div class="p-2 bg-green-500/10 rounded-lg">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M9 9a3 3 0 000 6h3v-6H9z" />
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-text-primary">Sound Settings</h3>
        </div>
        <div class="bg-background2 rounded-lg p-4">
          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <div class="space-y-1">
                <label class="text-base font-medium text-text-primary">Enable Sounds</label>
                <p class="text-sm text-text-secondary">Play notification sounds</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  checked={notifications().enableSounds}
                  onChange={(e) => updateNotificationSettings({ enableSounds: e.target.checked })}
                />
                <div class="w-11 h-6 bg-background1 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <Show when={notifications().enableSounds}>
              <div class="space-y-4 pl-4 border-l-2 border-background1">
                {/* Volume Control */}
                <div class="space-y-2">
                  <label class="text-sm font-medium text-text-primary">Volume</label>
                  <div class="flex items-center space-x-3">
                    <svg class="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.828 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.828l3.555-3.793a1 1 0 011.617.793z" />
                    </svg>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={notifications().soundVolume}
                      onInput={handleVolumeChange}
                      class="flex-1 h-2 bg-background1 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <svg class="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.828 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.828l3.555-3.793a1 1 0 011.617.793zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z" />
                    </svg>
                    <span class="text-sm text-text-secondary w-8">{Math.round(notifications().soundVolume * 100)}%</span>
                  </div>
                </div>

                {/* Test Sound */}
                <div class="space-y-3">
                  <button
                    onClick={() => handleTestSound('message')}
                    disabled={isTestingSound()}
                    class="px-4 py-2 bg-background1 hover:bg-accent text-text-primary text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                  >
                    {isTestingSound() ? 'Playing...' : 'Test Notification Sound'}
                  </button>
                </div>

                {/* Mute All Sounds */}
                <div class="flex items-center justify-between">
                  <div class="space-y-1">
                    <label class="text-sm font-medium text-text-primary">Mute All Sounds</label>
                    <p class="text-xs text-text-secondary">Temporarily disable all notification sounds</p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      class="sr-only peer"
                      checked={notifications().muteAllSounds}
                      onChange={(e) => updateNotificationSettings({ muteAllSounds: e.target.checked })}
                    />
                    <div class="w-11 h-6 bg-background1 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Notification Filters Section */}
      <div class="bg-background1 rounded-lg p-6 mb-6">
        <div class="flex items-center gap-4 mb-4">
          <div class="p-2 bg-purple-500/10 rounded-lg">
            <svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-text-primary">Notification Filters</h3>
        </div>
        <div class="bg-background2 rounded-lg p-4">
          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <div class="space-y-1">
                <label class="text-base font-medium text-text-primary">Only Mentions & PMs</label>
                <p class="text-sm text-text-secondary">Only notify for mentions and private messages</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  checked={notifications().onlyMentionsAndPMs}
                  onChange={(e) => updateNotificationSettings({ onlyMentionsAndPMs: e.target.checked })}
                />
                <div class="w-11 h-6 bg-background1 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div class="flex items-center justify-between">
              <div class="space-y-1">
                <label class="text-base font-medium text-text-primary">Respect Do Not Disturb</label>
                <p class="text-sm text-text-secondary">Suppress notifications when status is set to DND</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  checked={notifications().respectDndStatus}
                  onChange={(e) => updateNotificationSettings({ respectDndStatus: e.target.checked })}
                />
                <div class="w-11 h-6 bg-background1 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div class="flex items-start space-x-3">
          <svg class="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
          <div class="space-y-1">
            <p class="text-sm text-blue-400 font-medium">About Notifications</p>
            <p class="text-xs text-blue-300">
              Notifications will only appear when StrafeChat is not in focus. 
              Visual unread indicators will always be shown regardless of your notification settings.
            </p>
          </div>
        </div>
      </div>
     </div>
   );
 };

export default NotificationSettings;