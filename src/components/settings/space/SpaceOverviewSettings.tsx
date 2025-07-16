import { Component, createSignal } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { Space } from "../../../lib/cache/SpaceCache";
import { api } from "../../../lib/api";
import { BASE_URL, FS_URL } from "../../../constants";
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
  const [saving, setSaving] = createSignal(false);
  const [uploadingIcon, setUploadingIcon] = createSignal(false);
  const [uploadingBanner, setUploadingBanner] = createSignal(false);

  const isOwner = () => props.space.owner_id === user()?.id;

  const handleSave = async () => {
    if (!isOwner() || saving()) return;
    
    setSaving(true);
    try {
      const updateData: any = {};
      
      // Only include fields that have changed
      if (name().trim() !== props.space.name) {
        updateData.name = name().trim();
      }
      if (description().trim() !== (props.space.description || "")) {
        updateData.description = description().trim();
      }
      if (nameAcronym().trim() !== props.space.name_acronym) {
        updateData.name_acronym = nameAcronym().trim();
      }
      if (vanityUrl().trim() !== (props.space.vanity_url_code || "")) {
        updateData.vanity_url_code = vanityUrl().trim();
      }
      if (preferredLocale() !== props.space.preferred_locale) {
        updateData.preferred_locale = preferredLocale();
      }
      
      // Only make API call if there are changes
      if (Object.keys(updateData).length > 0) {
        await api.spaces.update(props.space.id, updateData);
        console.log("Space settings updated successfully");
      }
    } catch (error) {
      console.error("Failed to update space settings:", error);
    } finally {
      setSaving(false);
    }
  };
  
  const handleIconUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !isOwner() || uploadingIcon()) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }
    
    setUploadingIcon(true);
    try {
      // Step 1: Upload file to Nebula service
      const formData = new FormData();
      formData.append('icon', file);
      
      const uploadResponse = await fetch(`${FS_URL}/api/v1/spaces/${props.space.id}/icon`, {
        method: 'POST',
        headers: {
          'X-Session-Token': localStorage.getItem('sc_token') || '',
        },
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload icon to file service');
      }
      
      const uploadResult = await uploadResponse.json();
      console.log('Space icon uploaded to Nebula successfully:', uploadResult);
      
      // Step 2: Update space with the file ID in Equinox
      const updateResponse = await fetch(`${BASE_URL}/spaces/${props.space.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': localStorage.getItem('sc_token') || '',
        },
        body: JSON.stringify({
          icon: uploadResult.filename
        }),
      });
      
      if (!updateResponse.ok) {
        throw new Error('Failed to update space with new icon');
      }
      
      console.log('Space icon updated successfully');
    } catch (error) {
      console.error('Failed to upload space icon:', error);
      alert('Failed to upload space icon. Please try again.');
    } finally {
      setUploadingIcon(false);
      // Reset the input
      input.value = '';
    }
  };

  const handleBannerUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !isOwner() || uploadingBanner()) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    // Validate file size (10MB limit for banners)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }
    
    setUploadingBanner(true);
    try {
      // Step 1: Upload file to Nebula service
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await fetch(`${FS_URL}/api/v1/spaces/${props.space.id}/banner`, {
        method: 'POST',
        headers: {
          'X-Session-Token': localStorage.getItem('sc_token') || '',
        },
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload banner to file service');
      }
      
      const uploadResult = await uploadResponse.json();
      console.log('Space banner uploaded to Nebula successfully:', uploadResult);
      
      // Step 2: Update space with the file ID in Equinox
      const updateResponse = await fetch(`${BASE_URL}/spaces/${props.space.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': localStorage.getItem('sc_token') || '',
        },
        body: JSON.stringify({
          banner: uploadResult.filename
        }),
      });
      
      if (!updateResponse.ok) {
        throw new Error('Failed to update space with new banner');
      }
      
      console.log('Space banner updated successfully');
    } catch (error) {
      console.error('Failed to upload space banner:', error);
      alert('Failed to upload space banner. Please try again.');
    } finally {
      setUploadingBanner(false);
      // Reset the input
      input.value = '';
    }
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
              <p class="text-text-secondary text-sm mb-3">Upload a custom icon for your space (max 5MB)</p>
              <div class="flex items-center gap-3">
                {props.space.icon && (
                  <img 
                    src={props.space.icon} 
                    alt="Space icon" 
                    class="w-12 h-12 rounded-lg object-cover border border-border"
                  />
                )}
                <div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleIconUpload}
                    disabled={!isOwner() || uploadingIcon()}
                    class="hidden" 
                    id="space-icon-upload"
                  />
                  <label 
                    for="space-icon-upload"
                    class={`inline-block px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                      !isOwner() || uploadingIcon() 
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                        : 'bg-primary text-white hover:bg-primary-dark'
                    }`}
                  >
                    {uploadingIcon() ? 'Uploading...' : 'Upload Icon'}
                  </label>
                </div>
              </div>
            </div>
            <div class="p-4 bg-background2 border border-border rounded-lg">
              <h4 class="text-text-primary font-medium mb-2">Space Banner</h4>
              <p class="text-text-secondary text-sm mb-3">Upload a banner image for your space (max 10MB)</p>
              <div class="flex items-center gap-3">
                {props.space.banner && (
                  <img 
                    src={props.space.banner} 
                    alt="Space banner" 
                    class="w-20 h-12 rounded-lg object-cover border border-border"
                  />
                )}
                <div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleBannerUpload}
                    disabled={!isOwner() || uploadingBanner()}
                    class="hidden" 
                    id="space-banner-upload"
                  />
                  <label 
                    for="space-banner-upload"
                    class={`inline-block px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                      !isOwner() || uploadingBanner() 
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                        : 'bg-primary text-white hover:bg-primary-dark'
                    }`}
                  >
                    {uploadingBanner() ? 'Uploading...' : 'Upload Banner'}
                  </label>
                </div>
              </div>
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
              disabled={saving()}
              class={`px-6 py-2 rounded-lg transition-colors ${
                saving() 
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {saving() ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpaceOverviewSettings;