import { Component, createSignal, createEffect } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";
import { apiRequest } from "../../lib/api";
import { BASE_URL, FS_URL } from "../../constants";
import { useToast } from "../common/Toast";
import { Avatar } from "../common/Avatar";
import Modal from "./Modal";

interface Bot {
  user_id: string;
  username: string;
  discriminator: number;
  description?: string;
  avatar?: string;
  public: boolean;
  discoverable: boolean;
  terms_of_service_url?: string;
  privacy_policy_url?: string;
  created_at?: string;
  token?: string;
}

interface BotModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  bot?: Bot;
  onBotCreated?: (bot: Bot & { token: string }) => void;
  onBotUpdated?: (bot: Bot) => void;
}

const BotModal: Component<BotModalProps> = (props) => {
  const [t] = useTransContext();
  const { showToast } = useToast();
  const [loading, setLoading] = createSignal(false);
  
  // Form state
  const [form, setForm] = createSignal({
    username: "",
    discriminator: 0,
    description: "",
    public: false,
    discoverable: false,
    terms_of_service_url: "",
    privacy_policy_url: ""
  });

  const handleAvatarUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid image file", "error");
      return;
    }

    if (!props.bot) {
      showToast("Bot must be created before uploading avatar", "error");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      setAvatarUploading(true);
      
      // Upload to Nebula (file storage)
      const uploadResponse = await fetch(`${FS_URL}/api/v1/bots/${props.bot.user_id}/avatar`, {
        method: "POST",
        headers: {
          "X-Session-Token": localStorage.getItem("sc_token") || ""
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload avatar");
      }

      const uploadData = await uploadResponse.json();
      
      // Update bot avatar in Equinox (database)
      await apiRequest(`${BASE_URL}/bots/${props.bot.user_id}/avatar`, {
        method: "POST",
        body: { avatar: uploadData.file.id }
      });

      // Update the bot object with new avatar
      const updatedBot = { ...props.bot, avatar: uploadData.file.id };
      props.onBotUpdated?.(updatedBot);
      
      showToast("Avatar updated successfully!", "success");
    } catch (error: any) {
      console.error("Failed to upload avatar:", error);
      showToast(error.message || "Failed to upload avatar", "error");
    } finally {
      setAvatarUploading(false);
    }
  };

  const [avatarUploading, setAvatarUploading] = createSignal(false);

  // Reset form when modal opens/closes or mode changes
  createEffect(() => {
    if (props.isOpen) {
      if (props.mode === "edit" && props.bot) {
        setForm({
          username: props.bot.username,
          discriminator: props.bot.discriminator,
          description: props.bot.description || "",
          public: props.bot.public,
          discoverable: props.bot.discoverable,
          terms_of_service_url: props.bot.terms_of_service_url || "",
          privacy_policy_url: props.bot.privacy_policy_url || ""
        });
      } else {
        setForm({
          username: "",
          discriminator: 0,
          description: "",
          public: false,
          discoverable: false,
          terms_of_service_url: "",
          privacy_policy_url: ""
        });
      }
    }
  });



  const handleSubmit = async () => {
    const currentForm = form();
    if (!currentForm.username.trim()) {
      showToast("Username is required", "error");
      return;
    }

    if (props.mode === "create" && !currentForm.discriminator) {
      showToast("Please enter a discriminator (1-9999)", "error");
      return;
    }

    // Validate discriminator range
    if (props.mode === "create") {
      const disc = currentForm.discriminator;
      if (disc < 1 || disc > 9999) {
        showToast("Discriminator must be a number between 1 and 9999", "error");
        return;
      }
    }

    try {
      setLoading(true);
      
      if (props.mode === "create") {
        const response = await apiRequest<{ bot: Bot; token: string }>(`${BASE_URL}/bots`, {
          method: "POST",
          body: currentForm
        });
        
        props.onBotCreated?.({ ...response.bot, token: response.token });
        showToast("Bot created successfully!", "success");
      } else if (props.mode === "edit" && props.bot) {
        const response = await apiRequest<{ bot: Bot }>(`${BASE_URL}/bots/${props.bot.user_id}`, {
          method: "PATCH",
          body: currentForm
        });
        
        props.onBotUpdated?.(response.bot);
        showToast("Bot updated successfully!", "success");
      }
      
      props.onClose();
    } catch (error: any) {
      console.error(`Failed to ${props.mode} bot:`, error);
      showToast(error.message || `Failed to ${props.mode} bot`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
    >
      <div class="space-y-4">
        <h2 class="text-xl font-semibold text-text-primary mb-4">
          {props.mode === "create" ? "Create New Bot" : "Edit Bot"}
        </h2>
        
        {props.mode === "edit" && props.bot && (
          <div class="mb-6">
            <label class="block text-text-primary text-sm font-medium mb-2">
              Bot Avatar
            </label>
            <div class="flex items-center gap-4">
              <Avatar
                userId={props.bot.user_id}
                avatar={props.bot.avatar}
                alt={props.bot.username}
                bot={true}
              />
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  class="hidden"
                  id="bot-avatar-upload"
                  disabled={avatarUploading()}
                />
                <label
                  for="bot-avatar-upload"
                  class="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {avatarUploading() ? "Uploading..." : "Change Avatar"}
                </label>
                <p class="text-text-tertiary text-xs mt-1">
                  Recommended: 512x512px, max 5MB
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div>
          <label class="block text-text-primary text-sm font-medium mb-2">
            Bot Username *
          </label>
          <input
            type="text"
            value={form().username}
            onInput={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
            placeholder="Enter bot username"
            class="w-full px-3 py-2 bg-background2 border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
            maxLength={32}
            disabled={props.mode === "edit"}
          />
        </div>

        {props.mode === "create" && (
          <div>
            <label class="block text-text-primary text-sm font-medium mb-2">
              Discriminator *
            </label>
            <input
              type="number"
              value={form().discriminator}
              onInput={(e) => setForm(prev => ({ ...prev, discriminator: parseInt(e.target.value) || 0 }))}
              placeholder="1234"
              class="w-full px-3 py-2 bg-background2 border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
              min="1"
              max="9999"
            />
            <p class="text-text-tertiary text-xs mt-1">
              Choose any number from 1 to 9999. If it's taken, you'll be notified.
            </p>
          </div>
        )}
        
        <div>
          <label class="block text-text-primary text-sm font-medium mb-2">
            Description
          </label>
          <textarea
            value={form().description}
            onInput={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what your bot does"
            class="w-full px-3 py-2 bg-background2 border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={3}
            maxLength={200}
          />
        </div>
        
        {props.mode === "edit" && (
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-text-primary font-medium">Public Bot</h4>
                <p class="text-text-secondary text-sm">Allow others to add this bot to their servers</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form().public}
                  onChange={(e) => setForm(prev => ({ ...prev, public: e.target.checked }))}
                  class="sr-only peer"
                />
                <div class="w-11 h-6 bg-background2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-text-primary font-medium">Discoverable</h4>
                <p class="text-text-secondary text-sm">Show this bot in the bot directory</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form().discoverable}
                  onChange={(e) => setForm(prev => ({ ...prev, discoverable: e.target.checked }))}
                  class="sr-only peer"
                />
                <div class="w-11 h-6 bg-background2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            
            <div>
              <label class="block text-text-primary text-sm font-medium mb-2">
                Terms of Service URL
              </label>
              <input
                type="url"
                value={form().terms_of_service_url}
                onInput={(e) => setForm(prev => ({ ...prev, terms_of_service_url: e.target.value }))}
                placeholder="https://example.com/terms"
                class="w-full px-3 py-2 bg-background2 border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            <div>
              <label class="block text-text-primary text-sm font-medium mb-2">
                Privacy Policy URL
              </label>
              <input
                type="url"
                value={form().privacy_policy_url}
                onInput={(e) => setForm(prev => ({ ...prev, privacy_policy_url: e.target.value }))}
                placeholder="https://example.com/privacy"
                class="w-full px-3 py-2 bg-background2 border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}
        
        <div class="flex justify-end gap-3 pt-4">
          <button
            onClick={props.onClose}
            class="px-4 py-2 text-text-secondary hover:text-text-primary transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading() || !form().username.trim() || (props.mode === "create" && !form().discriminator)}
            class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading() ? 
              (props.mode === "create" ? "Creating..." : "Updating...") : 
              (props.mode === "create" ? "Create Bot" : "Update Bot")
            }
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default BotModal;