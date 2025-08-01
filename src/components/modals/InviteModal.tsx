import { Component, createSignal, Show } from "solid-js";
import Modal from "./Modal";
import { api } from "../../lib/api";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
}

export const InviteModal: Component<InviteModalProps> = (props) => {
  const [createdInvite, setCreatedInvite] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [inviteMaxUses, setInviteMaxUses] = createSignal<number | undefined>(undefined);
  const [inviteExpiresIn, setInviteExpiresIn] = createSignal<string>("");

  // Reset state when modal opens
  const handleOpen = () => {
    if (props.isOpen) {
      setCreatedInvite(null);
      setCopied(false);
      setInviteMaxUses(undefined);
      setInviteExpiresIn("");
    }
  };

  // Watch for modal open state changes
  (() => {
    handleOpen();
  })();

  const handleCreateInvite = async () => {
    if (!props.spaceId) return;
    setCreating(true);
    try {
      const inviteData: any = {};
      if (inviteMaxUses() !== undefined && inviteMaxUses()! > 0) {
        inviteData.max_uses = inviteMaxUses();
      }
      if (inviteExpiresIn()) {
        inviteData.expires_in = parseInt(inviteExpiresIn()) * 60 * 60; // hours to seconds
      }
      const newInvite = await api.spaces.invites.create(props.spaceId, inviteData);
      setCreatedInvite(newInvite.code);
    } catch (err) {
      setCreatedInvite(null);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setCopied(false);
    props.onClose();
  };

  return (
    <Modal isOpen={props.isOpen} onClose={handleClose}>
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-text-primary">Create Space Invite</h3>
        <p class="text-sm text-text-secondary">
          Create an invite link to share your space with others.
        </p>
        
        <Show when={!createdInvite()}>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-text-primary mb-2">
                Max Uses (Optional)
              </label>
              <input
                type="number"
                min="1"
                placeholder="Unlimited"
                value={inviteMaxUses() || ""}
                onInput={(e) => {
                  const value = e.currentTarget.value;
                  setInviteMaxUses(value ? parseInt(value) : undefined);
                }}
                class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-text-primary mb-2">
                Expires In (Hours)
              </label>
              <select
                value={inviteExpiresIn()}
                onChange={(e) => setInviteExpiresIn(e.currentTarget.value)}
                class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Never</option>
                <option value="1">1 Hour</option>
                <option value="6">6 Hours</option>
                <option value="12">12 Hours</option>
                <option value="24">1 Day</option>
                <option value="168">1 Week</option>
                <option value="720">1 Month</option>
              </select>
            </div>
            <button
              class="bg-primary text-white px-4 py-2 rounded-lg font-semibold w-full mt-2 disabled:opacity-50"
              disabled={creating()}
              onClick={handleCreateInvite}
            >
              {creating() ? "Creating..." : "Create Invite"}
            </button>
          </div>
        </Show>
        
        <Show when={!!createdInvite()}>
          <div class="mt-4 flex flex-col items-center space-y-3">
            <div class="bg-surface px-3 py-2 rounded text-primary font-mono text-center break-all">
              {window.location.origin}/invite/{createdInvite()}
            </div>
            <button
              class={`bg-primary text-white px-4 py-2 rounded-lg font-semibold transition-all ${
                copied() ? "bg-green-500 scale-105" : ""
              }`}
              onClick={async () => {
                await navigator.clipboard.writeText(
                  `${window.location.origin}/invite/${createdInvite()}`
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied() ? "Copied!" : "Copy Invite Link"}
            </button>
          </div>
        </Show>
      </div>
    </Modal>
  );
};

export default InviteModal;