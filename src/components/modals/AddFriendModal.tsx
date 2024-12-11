import { Component, createSignal } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";
import Modal from "./Modal";
import { API_ENDPOINTS } from "../../lib/providers/auth/AuthProvider";

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddFriendModal: Component<AddFriendModalProps> = (props) => {
  const [t] = useTransContext();
  const [friendTag, setFriendTag] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const tag = friendTag().trim();
      const [username, discriminator] = tag.split("#");

      if (!username || !discriminator) {
        throw new Error(t("friends.errors.invalidTag"));
      }

      const discrimNum = parseInt(discriminator, 10);
      if (isNaN(discrimNum) || discrimNum < 1 || discrimNum > 9999) {
        throw new Error(t("friends.errors.invalidTag"));
      }

      const response = await fetch(API_ENDPOINTS.RELATIONSHIPS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": localStorage.getItem("sc_token") || "",
        },
        body: JSON.stringify({
          username,
          discriminator: discrimNum,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.code
            ? t(`friends.errors.${data.code}`)
            : data.message || t("common.unknownError")
        );
      }

      props.onClose();
    } catch (err) {
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
            {t("friends.addFriend")}
          </h3>
        </div>
        <form onSubmit={handleSubmit} class="space-y-6">
          <div>
            <label
              for="friendTag"
              class="block text-sm font-medium mb-2 text-text-primary"
            >
              {t("friends.friendTag")}
            </label>
            <input
              type="text"
              id="friendTag"
              value={friendTag()}
              onInput={(e) => setFriendTag(e.currentTarget.value)}
              class="w-full px-4 py-2.5 bg-background border-2 border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-text-secondary"
              placeholder={t("friends.enterFriendTag")}
              disabled={loading()}
            />
          </div>
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
                class="px-4 py-2.5 text-text-primary hover:bg-surface rounded-md transition-colors font-medium"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={loading()}
                class="px-4 py-2.5 bg-primary text-text-inverse rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
              >
                {loading() ? t("common.loading") : t("friends.addFriend")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
