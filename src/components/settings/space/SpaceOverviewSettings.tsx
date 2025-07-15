import { Component, createSignal } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { Space } from "../../../lib/cache/SpaceCache";
import Settings from "../../shared/icons/Settings";
import Globe from "../../shared/icons/Globe";

interface SpaceOverviewSettingsProps {
  space: Space;
}

const SpaceOverviewSettings: Component<SpaceOverviewSettingsProps> = (props) => {
  const { isMobile, user } = useAuth();
  const [name, setName] = createSignal(props.space.name);
  const [description, setDescription] = createSignal(props.space.description || "");
  const [nameAcronym, setNameAcronym] = createSignal(props.space.name_acronym);
  const [vanityUrl, setVanityUrl] = createSignal(props.space.vanity_url_code || "");
  const [preferredLocale, setPreferredLocale] = createSignal(props.space.preferred_locale);

  const isOwner = () => props.space.owner_id === user()?.id;

  const handleSave = async () => {
    // TODO: Implement API call to update space settings
    console.log("Saving space settings:", {
      name: name(),
      description: description(),
      name_acronym: nameAcronym(),
      vanity_url_code: vanityUrl(),
      preferred_locale: preferredLocale(),
    });
  };

  return (
    <div class={`mb-8 ${isMobile() ? "" : "mr-5"}`}>
      {/* Header with Icon */}
      <div class="flex items-center gap-3 mb-6">
        <div class="p-3 bg-primary/10 rounded-lg">
          <Settings />
        </div>
        <div>
          <h2 class="text-xl font-semibold text-text-primary mb-1">
            Space Overview
          </h2>
          <p class="text-text-secondary text-xs">
            Manage your space's basic information and settings
          </p>
        </div>
      </div>

      {/* Space Information */}
      <div class="space-y-6">
        {/* Basic Information */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <Settings />
            </div>
            <h3 class="text-lg font-semibold text-text-primary">Basic Information</h3>
          </div>
          <div class="space-y-4">
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">Space Name</label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                disabled={!isOwner()}
                class="p-3 bg-background2 border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Enter space name"
              />
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">Space Acronym</label>
              <input
                type="text"
                value={nameAcronym()}
                onInput={(e) => setNameAcronym(e.currentTarget.value)}
                disabled={!isOwner()}
                maxLength={4}
                class="p-3 bg-background2 border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="ABCD"
              />
              <p class="text-xs text-text-secondary">Used as the space icon when no custom icon is set (max 4 characters)</p>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">Description</label>
              <textarea
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                disabled={!isOwner()}
                rows={3}
                class="p-3 bg-background2 border border-border rounded-lg text-text-primary resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Describe your space..."
              />
            </div>
          </div>
        </div>

        {/* Space Customization */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-purple-500/10 rounded-lg">
              <div class="w-5 h-5 text-purple-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
              </div>
            </div>
            <h3 class="text-lg font-semibold text-text-primary">Customization</h3>
          </div>
          <div class="space-y-4">
            <div class="p-4 bg-background2 border border-border rounded-lg">
              <h4 class="text-text-primary font-medium mb-2">Space Icon</h4>
              <p class="text-text-secondary text-sm mb-3">Upload a custom icon for your space</p>
              <button 
                disabled={!isOwner()}
                class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload Icon
              </button>
            </div>
            <div class="p-4 bg-background2 border border-border rounded-lg">
              <h4 class="text-text-primary font-medium mb-2">Space Banner</h4>
              <p class="text-text-secondary text-sm mb-3">Upload a banner image for your space</p>
              <button 
                disabled={!isOwner()}
                class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload Banner
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-blue-500/10 rounded-lg">
              <Globe />
            </div>
            <h3 class="text-lg font-semibold text-text-primary">Advanced Settings</h3>
          </div>
          <div class="space-y-4">
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">Vanity URL</label>
              <div class="flex items-center gap-2">
                <span class="text-text-secondary text-sm">strafe.chat/</span>
                <input
                  type="text"
                  value={vanityUrl()}
                  onInput={(e) => setVanityUrl(e.currentTarget.value)}
                  disabled={!isOwner()}
                  class="flex-1 p-3 bg-background2 border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="custom-url"
                />
              </div>
              <p class="text-xs text-text-secondary">Create a custom invite link for your space</p>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">Preferred Language</label>
              <select
                value={preferredLocale()}
                onChange={(e) => setPreferredLocale(e.currentTarget.value)}
                disabled={!isOwner()}
                class="p-3 bg-background2 border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Español</option>
                <option value="fr-FR">Français</option>
                <option value="de-DE">Deutsch</option>
                <option value="it-IT">Italiano</option>
                <option value="pt-BR">Português (Brasil)</option>
                <option value="ru-RU">Русский</option>
                <option value="ja-JP">日本語</option>
                <option value="ko-KR">한국어</option>
                <option value="zh-CN">中文 (简体)</option>
                <option value="zh-TW">中文 (繁體)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        {isOwner() && (
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

export default SpaceOverviewSettings;