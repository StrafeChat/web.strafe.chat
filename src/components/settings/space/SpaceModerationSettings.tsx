import { Component, createSignal } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { Space } from "../../../lib/cache/SpaceCache";
import Shield from "../../shared/icons/Shield";
import Settings from "../../shared/icons/Settings";

interface SpaceModerationSettingsProps {
  space: Space;
}

const SpaceModerationSettings: Component<SpaceModerationSettingsProps> = (props) => {
  const { isMobile, user } = useAuth();
  const [afkTimeout, setAfkTimeout] = createSignal(props.space.afk_timeout);
  const [afkRoomId, setAfkRoomId] = createSignal(props.space.afk_room_id || "");
  const [systemRoomId, setSystemRoomId] = createSignal(props.space.system_room_id || "");
  const [rulesRoomId, setRulesRoomId] = createSignal(props.space.rules_room_id || "");
  const [publicUpdatesRoomId, setPublicUpdatesRoomId] = createSignal(props.space.public_updates_room_id || "");
  const [maxPresences, setMaxPresences] = createSignal(props.space.max_presences || 0);
  const [maxMembers, setMaxMembers] = createSignal(props.space.max_members || 0);
  const [maxVideoRoomUsers, setMaxVideoRoomUsers] = createSignal(props.space.max_video_room_users || 0);

  const isOwner = () => props.space.owner_id === user()?.id;
  const canManage = () => isOwner(); // TODO: Add role-based permissions

  const handleSave = async () => {
    // TODO: Implement API call to update space moderation settings
    console.log("Saving space moderation settings:", {
      afk_timeout: afkTimeout(),
      afk_room_id: afkRoomId() || null,
      system_room_id: systemRoomId() || null,
      rules_room_id: rulesRoomId() || null,
      public_updates_room_id: publicUpdatesRoomId() || null,
      max_presences: maxPresences(),
      max_members: maxMembers(),
      max_video_room_users: maxVideoRoomUsers(),
    });
  };

  const getAfkTimeoutText = (timeout: number) => {
    if (timeout === 0) return "Never";
    if (timeout < 60) return `${timeout} seconds`;
    if (timeout < 3600) return `${Math.floor(timeout / 60)} minutes`;
    return `${Math.floor(timeout / 3600)} hours`;
  };

  return (
    <div class={`mb-8 ${isMobile() ? "" : "mr-5"}`}>
      {/* Header with Icon */}
      <div class="flex items-center gap-3 mb-6">
        <div class="p-3 bg-yellow-500/10 rounded-lg">
          <Shield />
        </div>
        <div>
          <h2 class="text-xl font-semibold text-text-primary mb-1">
            Moderation
          </h2>
          <p class="text-text-secondary text-xs">
            Configure moderation tools and automated systems for your space
          </p>
        </div>
      </div>

      {/* Moderation Settings */}
      <div class="space-y-6">
        {/* AFK Settings */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-purple-500/10 rounded-lg">
              <div class="w-5 h-5 text-purple-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
              </div>
            </div>
            <h3 class="text-lg font-semibold text-text-primary">AFK Settings</h3>
          </div>
          <div class="space-y-4">
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">AFK Timeout</label>
              <select
                value={afkTimeout()}
                onChange={(e) => setAfkTimeout(parseInt(e.currentTarget.value))}
                disabled={!canManage()}
                class="p-3 bg-background2 border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value={0}>Never</option>
                <option value={60}>1 minute</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
                <option value={900}>15 minutes</option>
                <option value={1800}>30 minutes</option>
                <option value={3600}>1 hour</option>
              </select>
              <p class="text-xs text-text-secondary">
                How long before a user is moved to the AFK channel. Current: {getAfkTimeoutText(afkTimeout())}
              </p>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">AFK Channel</label>
              <select
                value={afkRoomId()}
                onChange={(e) => setAfkRoomId(e.currentTarget.value)}
                disabled={!canManage()}
                class="p-3 bg-background2 border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">No AFK Channel</option>
                {/* TODO: Populate with actual voice channels */}
                <option value="example-1">General Voice</option>
                <option value="example-2">AFK Channel</option>
              </select>
              <p class="text-xs text-text-secondary">
                Voice channel where AFK users will be moved
              </p>
            </div>
          </div>
        </div>

        {/* System Channels */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-blue-500/10 rounded-lg">
              <Settings />
            </div>
            <h3 class="text-lg font-semibold text-text-primary">System Channels</h3>
          </div>
          <div class="space-y-4">
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">System Messages Channel</label>
              <select
                value={systemRoomId()}
                onChange={(e) => setSystemRoomId(e.currentTarget.value)}
                disabled={!canManage()}
                class="p-3 bg-background2 border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">No System Channel</option>
                {/* TODO: Populate with actual text channels */}
                <option value="example-1">general</option>
                <option value="example-2">announcements</option>
              </select>
              <p class="text-xs text-text-secondary">
                Channel for system messages like member joins and boosts
              </p>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">Rules Channel</label>
              <select
                value={rulesRoomId()}
                onChange={(e) => setRulesRoomId(e.currentTarget.value)}
                disabled={!canManage()}
                class="p-3 bg-background2 border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">No Rules Channel</option>
                {/* TODO: Populate with actual text channels */}
                <option value="example-1">rules</option>
                <option value="example-2">guidelines</option>
              </select>
              <p class="text-xs text-text-secondary">
                Channel containing your space rules and guidelines
              </p>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">Public Updates Channel</label>
              <select
                value={publicUpdatesRoomId()}
                onChange={(e) => setPublicUpdatesRoomId(e.currentTarget.value)}
                disabled={!canManage()}
                class="p-3 bg-background2 border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">No Updates Channel</option>
                {/* TODO: Populate with actual text channels */}
                <option value="example-1">announcements</option>
                <option value="example-2">updates</option>
              </select>
              <p class="text-xs text-text-secondary">
                Channel for public space updates and announcements
              </p>
            </div>
          </div>
        </div>

        {/* Limits */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-orange-500/10 rounded-lg">
              <div class="w-5 h-5 text-orange-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
            </div>
            <h3 class="text-lg font-semibold text-text-primary">Space Limits</h3>
          </div>
          <div class="space-y-4">
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">Maximum Members</label>
              <input
                type="number"
                value={maxMembers()}
                onInput={(e) => setMaxMembers(parseInt(e.currentTarget.value) || 0)}
                disabled={!canManage()}
                min={0}
                class="p-3 bg-background2 border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="0 = unlimited"
              />
              <p class="text-xs text-text-secondary">
                Maximum number of members allowed in this space (0 for unlimited)
              </p>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">Maximum Online Members</label>
              <input
                type="number"
                value={maxPresences()}
                onInput={(e) => setMaxPresences(parseInt(e.currentTarget.value) || 0)}
                disabled={!canManage()}
                min={0}
                class="p-3 bg-background2 border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="0 = unlimited"
              />
              <p class="text-xs text-text-secondary">
                Maximum number of members that can be online at once (0 for unlimited)
              </p>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">Maximum Video Room Users</label>
              <input
                type="number"
                value={maxVideoRoomUsers()}
                onInput={(e) => setMaxVideoRoomUsers(parseInt(e.currentTarget.value) || 0)}
                disabled={!canManage()}
                min={0}
                max={99}
                class="p-3 bg-background2 border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="0 = unlimited"
              />
              <p class="text-xs text-text-secondary">
                Maximum number of users in video rooms (0 for unlimited, max 99)
              </p>
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

export default SpaceModerationSettings;