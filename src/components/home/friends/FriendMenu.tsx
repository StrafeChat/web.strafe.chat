import { Component, createSignal, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { Tooltip } from "../../common/Tooltip";
import Modal from "../../modals/Modal";
import { BASE_URL } from "../../../constants";

interface FriendMenuProps {
  friendId: string;
  friendName: string;
}

export const FriendMenu: Component<FriendMenuProps> = (props) => {
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  // const [error, setError] = createSignal<string | null>(null);
  const [showConfirmation, setShowConfirmation] = createSignal(false);

  // Close menu when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".friend-menu")) {
      setIsMenuOpen(false);
    }
  };

  document.addEventListener("click", handleClickOutside);
  onCleanup(() => {
    document.removeEventListener("click", handleClickOutside);
  });

  const handleRemoveFriend = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/users/@me/relationships/${props.friendId}`,
        {
          method: "DELETE",
          headers: {
            "X-Session-Token": localStorage.getItem("sc_token") || "",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to remove friend");
      }

      setIsMenuOpen(false);
      setShowConfirmation(false);
    } catch (error) {
      console.error("Error removing friend:", error);
    }
  };

  return (
    <>
      <div class="friend-menu relative">
        <Tooltip content="More" position="top">
          <button
            class="p-2 rounded-full transition-colors bg-border hover:bg-[rgba(68,68,68,0.4)]"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen());
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        </Tooltip>

        {isMenuOpen() && (
          <div
            class="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-[#1e1f22] border border-[#2b2d31] z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="py-1">
              <button
                class="w-full px-4 py-2 text-sm text-text-danger hover:bg-[#2b2d31] flex items-center gap-2 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirmation(true);
                  setIsMenuOpen(false);
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                Remove Friend
              </button>
            </div>
          </div>
        )}
      </div>

      <Portal>
        <Modal
          isOpen={showConfirmation()}
          onClose={() => setShowConfirmation(false)}
        >
          <div class="space-y-6">
            <div>
              <h3 class="text-xl font-semibold text-text-primary mb-6">
                Remove '{props.friendName}''
              </h3>
            </div>
            <p class="text-text-primary mb-6">
              Are you sure you want to remove{" "}
              <span class="font-medium">{props.friendName}</span> from your
              friends?
            </p>
            <div class="border-t border-border pt-4">
              <div class="flex justify-end gap-3">
                <button
                  class="px-4 py-2.5 text-text-primary hover:bg-surface rounded-md transition-colors font-medium"
                  onClick={() => setShowConfirmation(false)}
                >
                  Cancel
                </button>
                <button
                  class="px-4 py-2.5 bg-[#da373c] text-text-primary rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
                  onClick={handleRemoveFriend}
                >
                  Remove Friend
                </button>
              </div>
            </div>
          </div>
        </Modal>
      </Portal>
    </>
  );
};
