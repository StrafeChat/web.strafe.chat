import {
  Component,
  createSignal,
  createMemo,
  For,
  createEffect,
  Show,
} from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { Space } from "../../../lib/cache/SpaceCache";
import { BASE_URL, FS_URL } from "../../../constants";
import { API_HEADERS } from "../../../lib/providers/auth/AuthProvider";

interface SpaceEmojiSettingsProps {
  space: Space;
}

interface CustomEmoji {
  id: string;
  space_id: string;
  shortcode: string;
  file_id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const SpaceEmojiSettings: Component<SpaceEmojiSettingsProps> = (props) => {
  const { isMobile, user } = useAuth();

  // State for emoji management
  const [emojis, setEmojis] = createSignal<CustomEmoji[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // State for upload form
  const [uploading, setUploading] = createSignal(false);
  const [uploadError, setUploadError] = createSignal<string | null>(null);
  const [shortcode, setShortcode] = createSignal("");
  const [name, setName] = createSignal("");
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);

  // State for deletion
  const [deleting, setDeleting] = createSignal<string | null>(null);

  // Check if user has permission to manage emojis
  const canManageEmojis = () => {
    // TODO: Implement proper permission checking
    // For now, assume space owners and admins can manage emojis
    return props.space.owner_id === user()?.id;
  };

  // Fetch custom emojis for the space
  const fetchEmojis = async () => {
    if (loading()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${BASE_URL}/spaces/${props.space.id}/emojis`,
        {
          headers: {
            ...API_HEADERS.JSON,
            ...API_HEADERS.SESSION(),
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch emojis: ${response.status}`);
      }

      const data = await response.json();
      setEmojis(data.emojis || []);
    } catch (err) {
      console.error("Failed to fetch custom emojis:", err);
      setError("Failed to load custom emojis");
    } finally {
      setLoading(false);
    }
  };

  // Load emojis on component mount
  createEffect(() => {
    fetchEmojis();
  });

  // Validate shortcode format
  const validateShortcode = (code: string): string | null => {
    if (!code) return "Shortcode is required";
    if (code.length < 2 || code.length > 32)
      return "Shortcode must be 2-32 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(code))
      return "Shortcode can only contain letters, numbers, and underscores";

    // Check for duplicates
    const existing = emojis().find((emoji) => emoji.shortcode === code);
    if (existing) return "An emoji with this shortcode already exists";

    return null;
  };

  // Validate file
  const validateFile = (file: File): string | null => {
    if (!file) return "Please select a file";

    // Check file type
    if (!file.type.startsWith("image/")) return "File must be an image";

    // Check file size (1MB limit)
    if (file.size > 1024 * 1024) return "File size must be less than 1MB";

    return null;
  };

  // Handle file selection
  const handleFileSelect = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      const fileError = validateFile(file);
      if (fileError) {
        setUploadError(fileError);
        setSelectedFile(null);
        setPreviewUrl(null);
        return;
      }

      setSelectedFile(file);
      setUploadError(null);

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  // Handle emoji upload
  const handleUpload = async () => {
    if (!canManageEmojis() || uploading()) return;

    const file = selectedFile();
    const shortcodeValue = shortcode().trim();
    const nameValue = name().trim();

    // Validate inputs
    const shortcodeError = validateShortcode(shortcodeValue);
    if (shortcodeError) {
      setUploadError(shortcodeError);
      return;
    }

    if (!nameValue) {
      setUploadError("Name is required");
      return;
    }

    if (nameValue.length > 64) {
      setUploadError("Name must be less than 64 characters");
      return;
    }

    const fileError = validateFile(file!);
    if (fileError) {
      setUploadError(fileError);
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      // Step 1: Upload file to Nebula
      const formData = new FormData();
      formData.append("emoji", file!);
      formData.append("shortcode", shortcodeValue);
      formData.append("name", nameValue);

      const uploadResponse = await fetch(
        `${FS_URL}/api/v1/spaces/${props.space.id}/emojis`,
        {
          method: "POST",
          headers: {
            "X-Session-Token": localStorage.getItem("sc_token") || "",
          },
          body: formData,
        },
      );

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Upload failed: ${uploadResponse.status}`,
        );
      }

      const uploadResult = await uploadResponse.json();

      // Step 2: Register emoji in Equinox
      const registerResponse = await fetch(
        `${BASE_URL}/spaces/${props.space.id}/emojis`,
        {
          method: "POST",
          headers: {
            ...API_HEADERS.JSON,
            ...API_HEADERS.SESSION(),
          },
          body: JSON.stringify({
            shortcode: shortcodeValue,
            file_id: uploadResult.file_id,
            name: nameValue,
          }),
        },
      );

      if (!registerResponse.ok) {
        const errorData = await registerResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Registration failed: ${registerResponse.status}`,
        );
      }

      // Reset form
      setShortcode("");
      setName("");
      setSelectedFile(null);
      setPreviewUrl(null);

      // Reset file input
      const fileInput = document.getElementById(
        "emoji-file-input",
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      // Refresh emoji list
      await fetchEmojis();
    } catch (err) {
      console.error("Failed to upload emoji:", err);
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload emoji",
      );
    } finally {
      setUploading(false);
    }
  };

  // Handle emoji deletion
  const handleDelete = async (emoji: CustomEmoji) => {
    if (!canManageEmojis() || deleting()) return;

    if (
      !confirm(
        `Are you sure you want to delete the emoji "${emoji.name}" (:${emoji.shortcode}:)?`,
      )
    ) {
      return;
    }

    setDeleting(emoji.id);

    try {
      const response = await fetch(
        `${BASE_URL}/spaces/${props.space.id}/emojis/${emoji.shortcode}`,
        {
          method: "DELETE",
          headers: {
            ...API_HEADERS.JSON,
            ...API_HEADERS.SESSION(),
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Delete failed: ${response.status}`);
      }

      // Refresh emoji list
      await fetchEmojis();
    } catch (err) {
      console.error("Failed to delete emoji:", err);
      alert(
        `Failed to delete emoji: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setDeleting(null);
    }
  };

  // Get emoji URL for display
  const getEmojiUrl = (emoji: CustomEmoji) => {
    return `${FS_URL}/custom_emojis/${props.space.id}/${emoji.shortcode}.png`;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Computed values
  const isFormValid = createMemo(() => {
    return (
      shortcode().trim() &&
      name().trim() &&
      selectedFile() &&
      !validateShortcode(shortcode().trim()) &&
      !validateFile(selectedFile()!)
    );
  });

  return (
    <div class={`mb-8 ${isMobile() ? "" : "mr-5"}`}>
      {/* Header with Icon */}
      <div class="flex items-center gap-3 mb-6">
        <div class="p-3 bg-yellow-500/10 rounded-lg">
          <svg
            class="w-6 h-6 text-yellow-500"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </div>
        <div>
          <h2 class="text-xl font-semibold text-text-primary mb-1">
            Custom Emojis
          </h2>
          <p class="text-text-secondary text-xs">
            Manage custom emojis for your space
          </p>
        </div>
      </div>

      {/* Upload Form */}
      <Show when={canManageEmojis()}>
        <div class="bg-background1 rounded-lg p-6 mb-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-green-500/10 rounded-lg">
              <svg
                class="w-5 h-5 text-green-500"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-text-primary">
              Add Custom Emoji
            </h3>
          </div>

          <div class="space-y-4">
            {/* File Upload */}
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">
                Emoji File
              </label>
              <div class="flex items-center gap-4">
                <div class="flex-1">
                  <input
                    type="file"
                    id="emoji-file-input"
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={uploading()}
                    class="w-full p-3 bg-background2 border border-border rounded-lg text-text-primary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <Show when={previewUrl()}>
                  <div class="w-12 h-12 border border-border rounded-lg overflow-hidden bg-background2 flex items-center justify-center">
                    <img
                      src={previewUrl()!}
                      alt="Preview"
                      class="w-full h-full object-contain"
                    />
                  </div>
                </Show>
              </div>
              <p class="text-xs text-text-secondary">
                Upload an image file (PNG, JPEG, GIF). Max size: 1MB.
                Recommended: 128x128px or smaller.
              </p>
            </div>

            {/* Shortcode */}
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">
                Shortcode
              </label>
              <input
                type="text"
                value={shortcode()}
                onInput={(e) => setShortcode(e.currentTarget.value)}
                disabled={uploading()}
                placeholder="my_emoji"
                class="p-3 bg-background2 border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p class="text-xs text-text-secondary">
                2-32 characters. Letters, numbers, and underscores only. Must be
                unique in this space.
              </p>
            </div>

            {/* Name */}
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">
                Display Name
              </label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                disabled={uploading()}
                placeholder="My Custom Emoji"
                maxLength={64}
                class="p-3 bg-background2 border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p class="text-xs text-text-secondary">
                A friendly name for your emoji (max 64 characters).
              </p>
            </div>

            {/* Error Display */}
            <Show when={uploadError()}>
              <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p class="text-red-400 text-sm">{uploadError()}</p>
              </div>
            </Show>

            {/* Upload Button */}
            <div class="flex justify-end">
              <button
                onClick={handleUpload}
                disabled={!isFormValid() || uploading()}
                class={`px-6 py-2 rounded-lg transition-colors ${
                  !isFormValid() || uploading()
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : "bg-green-500 text-white hover:bg-green-600"
                }`}
              >
                {uploading() ? "Uploading..." : "Add Emoji"}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Emoji List */}
      <div class="bg-background1 rounded-lg">
        <div class="p-4 border-b border-border">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-text-primary">
              Custom Emojis ({emojis().length})
            </h3>
            <Show when={!loading() && emojis().length > 0}>
              <button
                onClick={fetchEmojis}
                disabled={loading()}
                class="px-3 py-1 text-sm bg-background2 hover:bg-background3 border border-border rounded-lg transition-colors"
              >
                Refresh
              </button>
            </Show>
          </div>
        </div>

        <Show when={loading()}>
          <div class="p-8 text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p class="text-text-secondary mt-2">Loading emojis...</p>
          </div>
        </Show>

        <Show when={error()}>
          <div class="p-8 text-center">
            <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg inline-block">
              <p class="text-red-400">{error()}</p>
            </div>
            <div class="mt-4">
              <button
                onClick={fetchEmojis}
                class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </Show>

        <Show when={!loading() && !error()}>
          <Show
            when={emojis().length === 0}
            fallback={
              <div class="divide-y divide-border">
                <For each={emojis()}>
                  {(emoji) => (
                    <div class="p-4 flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class="w-12 h-12 border border-border rounded-lg overflow-hidden bg-background2 flex items-center justify-center">
                          <img
                            src={getEmojiUrl(emoji)}
                            alt={emoji.name}
                            class="w-full h-full object-contain"
                            loading="lazy"
                          />
                        </div>
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="text-text-primary font-medium">
                              {emoji.name}
                            </span>
                            <code class="text-xs bg-background2 px-2 py-1 rounded text-text-secondary">
                              :{emoji.shortcode}:
                            </code>
                          </div>
                          <div class="text-sm text-text-secondary">
                            Added {formatDate(emoji.created_at)}
                          </div>
                        </div>
                      </div>

                      <Show when={canManageEmojis()}>
                        <button
                          onClick={() => handleDelete(emoji)}
                          disabled={deleting() === emoji.id}
                          class="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete emoji"
                        >
                          <Show
                            when={deleting() === emoji.id}
                            fallback={
                              <svg
                                class="w-5 h-5"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                              </svg>
                            }
                          >
                            <div class="w-5 h-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
                          </Show>
                        </button>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            }
          >
            <div class="p-8 text-center text-text-secondary">
              <svg
                class="w-12 h-12 mx-auto mb-4 opacity-50"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <p class="text-lg mb-2">No custom emojis yet</p>
              <p class="text-sm">
                <Show
                  when={canManageEmojis()}
                  fallback="This space doesn't have any custom emojis."
                >
                  Add your first custom emoji using the form above.
                </Show>
              </p>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default SpaceEmojiSettings;
