import { Component, createSignal } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { Space } from "../../../lib/cache/SpaceCache";
import User from "../../shared/icons/User";
import Shield from "../../shared/icons/Shield";

interface SpaceSecuritySettingsProps {
  space: Space;
}

const SpaceSecuritySettings: Component<SpaceSecuritySettingsProps> = (props) => {
  const { isMobile, user } = useAuth();
  const [verificationLevel, setVerificationLevel] = createSignal(props.space.verification_level);
  const [explicitContentFilter, setExplicitContentFilter] = createSignal(props.space.explicit_content_filter);
  const [nsfwLevel, setNsfwLevel] = createSignal(props.space.nsfw_level);
  const [defaultMessageNotifications, setDefaultMessageNotifications] = createSignal(props.space.default_message_notifications);

  const isOwner = () => props.space.owner_id === user()?.id;
  const canManage = () => isOwner(); // TODO: Add role-based permissions

  const handleSave = async () => {
    // TODO: Implement API call to update space security settings
    console.log("Saving space security settings:", {
      verification_level: verificationLevel(),
      explicit_content_filter: explicitContentFilter(),
      nsfw_level: nsfwLevel(),
      default_message_notifications: defaultMessageNotifications(),
    });
  };

  const getVerificationLevelText = (level: number) => {
    switch (level) {
      case 0: return "None - No verification required";
      case 1: return "Low - Must have verified email";
      case 2: return "Medium - Must be registered for longer than 5 minutes";
      case 3: return "High - Must be a member for longer than 10 minutes";
      case 4: return "Highest - Must have a verified phone number";
      default: return "Unknown";
    }
  };

  const getContentFilterText = (level: number) => {
    switch (level) {
      case 0: return "Don't scan any media content";
      case 1: return "Scan media content from members without a role";
      case 2: return "Scan media content from all members";
      default: return "Unknown";
    }
  };

  const getNsfwLevelText = (level: number) => {
    switch (level) {
      case 0: return "Default";
      case 1: return "Explicit";
      case 2: return "Safe";
      case 3: return "Age Restricted";
      default: return "Unknown";
    }
  };

  const getNotificationText = (level: number) => {
    switch (level) {
      case 0: return "All messages";
      case 1: return "Only @mentions";
      case 2: return "Nothing";
      default: return "Unknown";
    }
  };

  return (
    <div class={`mb-8 ${isMobile() ? "" : "mr-5"}`}>
      {/* Header with Icon */}
      <div class="flex items-center gap-3 mb-6">
        <div class="p-3 bg-red-500/10 rounded-lg">
          <User />
        </div>
        <div>
          <h2 class="text-xl font-semibold text-text-primary mb-1">
            Security & Privacy
          </h2>
          <p class="text-text-secondary text-xs">
            Configure security settings and content moderation for your space
          </p>
        </div>
      </div>

      {/* Security Settings */}
      <div class="space-y-6">
        {/* Verification Level */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-blue-500/10 rounded-lg">
              <Shield />
            </div>
            <h3 class="text-lg font-semibold text-text-primary">Verification Level</h3>
          </div>
          <div class="space-y-4">
            <p class="text-text-secondary text-sm">
              Set the verification level required for members to send messages and join voice channels.
            </p>
            <div class="space-y-3">
              {[0, 1, 2, 3, 4].map((level) => (
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="verification-level"
                    value={level}
                    checked={verificationLevel() === level}
                    onChange={() => setVerificationLevel(level)}
                    disabled={!canManage()}
                    class="w-4 h-4 text-primary bg-background2 border-border focus:ring-primary disabled:opacity-50"
                  />
                  <div class="flex-1">
                    <div class="text-text-primary font-medium">
                      {level === 0 ? "None" : level === 1 ? "Low" : level === 2 ? "Medium" : level === 3 ? "High" : "Highest"}
                    </div>
                    <div class="text-text-secondary text-sm">
                      {getVerificationLevelText(level)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Explicit Content Filter */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-orange-500/10 rounded-lg">
              <div class="w-5 h-5 text-orange-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
            </div>
            <h3 class="text-lg font-semibold text-text-primary">Explicit Content Filter</h3>
          </div>
          <div class="space-y-4">
            <p class="text-text-secondary text-sm">
              Automatically scan and delete messages containing explicit content.
            </p>
            <div class="space-y-3">
              {[0, 1, 2].map((level) => (
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="content-filter"
                    value={level}
                    checked={explicitContentFilter() === level}
                    onChange={() => setExplicitContentFilter(level)}
                    disabled={!canManage()}
                    class="w-4 h-4 text-primary bg-background2 border-border focus:ring-primary disabled:opacity-50"
                  />
                  <div class="flex-1">
                    <div class="text-text-primary font-medium">
                      {level === 0 ? "Disabled" : level === 1 ? "Members without roles" : "All members"}
                    </div>
                    <div class="text-text-secondary text-sm">
                      {getContentFilterText(level)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* NSFW Level */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-red-500/10 rounded-lg">
              <div class="w-5 h-5 text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
            </div>
            <h3 class="text-lg font-semibold text-text-primary">NSFW Level</h3>
          </div>
          <div class="space-y-4">
            <p class="text-text-secondary text-sm">
              Set the NSFW (Not Safe For Work) classification for your space.
            </p>
            <div class="space-y-3">
              {[0, 1, 2, 3].map((level) => (
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="nsfw-level"
                    value={level}
                    checked={nsfwLevel() === level}
                    onChange={() => setNsfwLevel(level)}
                    disabled={!canManage()}
                    class="w-4 h-4 text-primary bg-background2 border-border focus:ring-primary disabled:opacity-50"
                  />
                  <div class="flex-1">
                    <div class="text-text-primary font-medium">
                      {getNsfwLevelText(level)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Default Notifications */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-green-500/10 rounded-lg">
              <div class="w-5 h-5 text-green-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                </svg>
              </div>
            </div>
            <h3 class="text-lg font-semibold text-text-primary">Default Notification Settings</h3>
          </div>
          <div class="space-y-4">
            <p class="text-text-secondary text-sm">
              Set the default notification level for new members joining your space.
            </p>
            <div class="space-y-3">
              {[0, 1, 2].map((level) => (
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="notifications"
                    value={level}
                    checked={defaultMessageNotifications() === level}
                    onChange={() => setDefaultMessageNotifications(level)}
                    disabled={!canManage()}
                    class="w-4 h-4 text-primary bg-background2 border-border focus:ring-primary disabled:opacity-50"
                  />
                  <div class="flex-1">
                    <div class="text-text-primary font-medium">
                      {getNotificationText(level)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Save Button */}
        {canManage() && (
          <div class="flex justify-end">
            <button
              onClick={handleSave}
              class="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpaceSecuritySettings;