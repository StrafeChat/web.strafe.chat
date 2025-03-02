import { Component, createSignal, For, Show } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import Modal from "./Modal";
import { useAuth, API_ENDPOINTS } from "../../lib/providers/auth/AuthProvider";
import {
  StatusIndicator,
  UserStatus,
} from "../../components/common/StatusIndicator";
import { FS_URL } from "../../constants";
import { FriendSearch } from "../home/friends/FriendSearch";

interface Friend {
  id: string;
  username: string;
  avatar: string;
  discriminator: string;
  display_name: string;
  presence?: {
    status: string;
    custom_status: string;
  };
}

interface CreatePMModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreatePMModal: Component<CreatePMModalProps> = (props) => {
  const [t] = useTransContext();
  const { relationships } = useAuth();
  const { getUser } = useCache();
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedFriends, setSelectedFriends] = createSignal<string[]>([]);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const filteredFriends = () => {
    const query = searchQuery().toLowerCase();
    const rels = relationships();
    if (!rels) return [];

    return rels
      .map((rel) => {
        const friend = getUser(rel);
        if (!friend) return null;
        return {
          id: friend.id,
          avatar: friend.avatar,
          username: friend.username,
          discriminator: friend.discriminator,
          display_name: friend.display_name || friend.username,
          presence: friend.presence,
        } as Friend;
      })
      .filter((friend): friend is Friend => friend !== null)
      .filter(
        (friend) =>
          friend.username.toLowerCase().includes(query) ||
          friend.display_name.toLowerCase().includes(query) ||
          `${friend.username}#${friend.discriminator}`
            .toLowerCase()
            .includes(query),
      );
  };

  const toggleFriendSelection = (userId: string) => {
    const current = selectedFriends();
    if (current.includes(userId)) {
      setSelectedFriends(current.filter((id) => id !== userId));
    } else {
      setSelectedFriends([...current, userId]);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (selectedFriends().length === 0) {
        throw new Error(t("pms.errors.selectFriends"));
      }

      // Check if more than one friend is selected to determine if it's a group
      const isGroup = selectedFriends().length > 1;

      const response = await fetch(API_ENDPOINTS.CREATE_ROOM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": localStorage.getItem("sc_token") || "",
        },
        body: JSON.stringify({
          recipients: selectedFriends(),
          is_group: isGroup, 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.code
            ? t(`pms.errors.${data.code}`)
            : data.message || t("common.unknownError"),
        );
      }

      props.onClose();
    } catch (err) {
      console.error("Error creating conversation:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("common.unknownError"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose}>
      <div class="space-y-6">
        <div>
          <h3 class="text-xl font-semibold text-text-primary mb-6">
            {t("pms.selectFriends")}
          </h3>
        </div>
        <form onSubmit={handleSubmit} class="space-y-6">
          <FriendSearch onSearch={setSearchQuery} />
          <Show
            when={filteredFriends().length > 0}
            fallback={
              <div class="text-text-secondary text-center p-4">
                {searchQuery()
                  ? "No friends found matching your search."
                  : "No friends added yet. Add some friends to get started!"}
              </div>
            }
          >
            <div class="max-h-64 overflow-y-auto space-y-2">
              <For each={filteredFriends()}>
                {(friend) => (
                  <div
                    class="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors cursor-pointer"
                    onClick={() => toggleFriendSelection(friend.id)}
                  >
                    <div class="flex items-center gap-3">
                      <div class="relative flex-shrink-0">
                        <img
                          src={`${FS_URL}/avatars/${friend.id}/${friend.avatar || "favicon.ico"}`}
                          alt={`${friend.display_name}'s avatar`}
                          class="w-8 h-8 rounded-full object-cover"
                        />
                        <StatusIndicator
                          status={
                            (friend.presence?.status || "offline") as UserStatus
                          }
                          class="border-background2"
                        />
                      </div>
                      <div class="flex flex-col">
                        <span class="text-text-primary">
                          {friend.display_name}
                        </span>
                        <span class="text-sm text-text-secondary">
                          {friend.presence?.status === "Offline"
                            ? "Offline"
                            : friend.presence?.custom_status ||
                              friend.presence?.status.charAt(0).toUpperCase() +
                                friend.presence!.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedFriends().includes(friend.id)}
                      class="w-5 h-5 rounded-md border-2 border-border text-accent focus:ring-2 focus:ring-accent focus:ring-offset-0 bg-background transition-colors"
                    />
                  </div>
                )}
              </For>
            </div>
          </Show>

          <div class="border-t border-border pt-4">
            {error() && (
              <div class="text-sm text-error bg-error/10 px-4 py-2.5 rounded-md mb-4">
                {error()}
              </div>
            )}
            <div class="flex justify-end gap-3">
              <button
                type="button"
                onClick={props.onClose}
                class="px-4 py-2 text-text-primary hover:bg-surface hover:bg-opacity-10 rounded-md transition-colors"
                disabled={loading()}
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading()}
              >
                {t("pms.create")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default CreatePMModal;
