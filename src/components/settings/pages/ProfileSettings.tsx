import { Component, createSignal, Show, createEffect } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { useTransContext } from "@mbarzda/solid-i18next";
import { Avatar } from "../../common/Avatar";
import { useToast } from "../../common/Toast";
import { BASE_URL, FS_URL } from "../../../constants";

const ProfileSettings: Component = () => {
  const { user, isMobile, updateUser } = useAuth();
  const [t] = useTransContext();
  const [uploading, setUploading] = createSignal(false);
  const [uploadingBanner, setUploadingBanner] = createSignal(false);
  const [bio, setBio] = createSignal("");
  const [originalBio, setOriginalBio] = createSignal("");

  const { showToast } = useToast();

  createEffect(() => {
    if (user()?.bio) {
      setBio(user()?.bio);
      setOriginalBio(user()?.bio);
    }
  });

  const handleBioSave = async () => {
    try {
      const res = await fetch(`${BASE_URL}/users/@me/bio`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": `${localStorage.getItem("sc_token")}`,
        },
        body: JSON.stringify({ bio: bio() }),
      });

      if (!res.ok) throw new Error("Failed to update bio");

      const updatedUser = await res.json();
      updateUser(updatedUser);
      setOriginalBio(bio());
      showToast(t("settings.profile.bio.success"), "success");
    } catch (error) {
      console.error("Bio update error:", error);
      showToast(t("settings.profile.bio.error"), "error");
    }
  };

  const handleAvatarUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith("image/")) {
      showToast(t("settings.profile.avatar.error.invalidType"), "error");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      setUploading(true);
      // Upload to nebula first
      const nebulaRes = await fetch(`${FS_URL}/api/v1/users/avatar`, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `${localStorage.getItem("sc_token")}`,
        },
      });

      if (!nebulaRes.ok) throw new Error("Failed to upload avatar");
      const { file: fileMetadata } = await nebulaRes.json();

      // Update user avatar in equinox
      const equinoxRes = await fetch(`${BASE_URL}/users/@me/avatar`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": `${localStorage.getItem("sc_token")}`,
        },
        body: JSON.stringify({ avatar: fileMetadata.id }),
      });

      if (!equinoxRes.ok) throw new Error("Failed to update avatar");
      const updatedUser = await equinoxRes.json();

      updateUser(updatedUser);
      showToast(t("settings.profile.avatar.success"), "success");
    } catch (error) {
      console.error("Avatar upload error:", error);
      showToast(t("settings.profile.avatar.error.generic"), "error");
    } finally {
      setUploading(false);
    }
  };

  const handleBannerUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith("image/")) {
      showToast(t("settings.profile.banner.error.invalidType"), "error");
      return;
    }

    const formData = new FormData();
    formData.append("banner", file);

    try {
      setUploadingBanner(true);
      // Upload to nebula first
      const nebulaRes = await fetch(`${FS_URL}/api/v1/users/banner`, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `${localStorage.getItem("sc_token")}`,
        },
      });

      if (!nebulaRes.ok) throw new Error("Failed to upload banner");

      const nebulaData = await nebulaRes.json();

      // Now update the banner in equinox
      const equinoxRes = await fetch(`${BASE_URL}/users/@me/banner`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": localStorage.getItem("sc_token") || "",
        },
        body: JSON.stringify({
          banner: nebulaData.file.id,
        }),
      });

      if (!equinoxRes.ok) throw new Error("Failed to update banner");

      await equinoxRes.json();
      updateUser({ banner: nebulaData.file.id });
      showToast(t("settings.profile.banner.success"), "success");
    } catch (error) {
      console.error("Error uploading banner:", error);
      showToast(t("settings.profile.banner.error.uploadFailed"), "error");
    } finally {
      setUploadingBanner(false);
    }
  };

  return (
    <div class={`mb-8 ${isMobile() ? "" : "mr-5"}`}>
      <h2 class="text-xl font-semibold text-text-primary mb-1">
        {t("settings.profile.title")}
      </h2>
      <p class="text-text-secondary mb-5 text-xs">
        {t("settings.profile.description")}
      </p>
      <div class="bg-background1 rounded-lg p-4">
        <div class="flex flex-col gap-6">
          {/* Banner Upload */}
          <div class="relative group w-full h-[150px] rounded-lg overflow-hidden">
            <Show
              when={user()?.banner}
              fallback={<div class="w-full h-full bg-primary" />}
            >
              <img
                src={`${FS_URL}/banners/${user()?.id}/${user()?.banner}`}
                alt={t("settings.profile.banner.alt")}
                class="w-full h-full object-fill bg-background2"
              />
            </Show>
            <label
              class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
              classList={{ "cursor-not-allowed": uploadingBanner() }}
            >
              <input
                type="file"
                accept="image/*"
                class="hidden"
                onChange={handleBannerUpload}
                disabled={uploadingBanner()}
              />
              <div class="flex items-center gap-2 text-white">
                <svg
                  class="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span class="text-sm font-medium">
                  {uploadingBanner()
                    ? t("settings.profile.banner.uploading")
                    : t("settings.profile.banner.change")}
                </span>
              </div>
            </label>
          </div>

          {/* Avatar Upload */}
          <div class="flex flex-col md:flex-row items-center md:items-start gap-4">
            <div class="relative group">
              <div class="relative w-20 h-20">
                <Avatar
                  userId={user()?.id || ""}
                  avatar={user()?.avatar}
                  alt={t("settings.profile.avatar.alt")}
                  size="xl"
                  class="w-full h-full"
                />
              </div>
              <label
                class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                classList={{ "cursor-not-allowed": uploading() }}
              >
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading()}
                />
                <span class="text-white text-sm text-center text-11">
                  {uploading()
                    ? t("settings.profile.avatar.uploading")
                    : t("settings.profile.avatar.change")}
                </span>
              </label>
            </div>
            <div class="flex-1 text-center md:text-left">
              <h3 class="text-lg font-semibold text-text-primary">
                {user()?.display_name || user()?.username}
              </h3>
              <p class="text-text-secondary text-sm">
                {user()?.username}#
                {String(user()?.discriminator).padStart(4, "0")}
              </p>
            </div>
          </div>

          {/* Bio Section */}
          <div class="flex flex-col gap-2">
            <label for="bio" class="text-sm font-medium text-text-primary">
              {t("settings.profile.bio.title")}
            </label>
            <textarea
              id="bio"
              value={bio()}
              onInput={(e) => setBio(e.currentTarget.value)}
              class="w-full p-2 bg-background2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              rows="4"
              maxLength="190"
            />
            <Show when={bio() !== originalBio()}>
              <div class="flex justify-end">
                <button
                  onClick={handleBioSave}
                  class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
                >
                  {t("common.save")}
                </button>
              </div>
            </Show>
          </div>

          {/* Rest of the profile settings */}
          <div class="flex flex-col gap-4">
            <div class="flex-1 text-center md:text-left"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
