import { Component, For, Show, createSignal } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { useCache } from "../../../lib/providers/cache/CacheProvider";
import UserPopupMenu from "../../common/UserPopupMenu";
import { Avatar } from "../../common/Avatar";

const MembersList: Component = () => {
  const { rooms } = useAuth();
  const cache = useCache();
  const [userPopupOpen, setUserPopupOpen] = createSignal(false);
  const [userPopupTrigger, setUserPopupTrigger] = createSignal<HTMLElement | undefined>();
  const [selectedUserId, setSelectedUserId] = createSignal<string | null>(null);

  // For demo: get current room and its members (replace with your actual logic)
  const currentRoom = () => rooms().find(r => r.id === window.location.pathname.split("/").pop());
  const members = () => {
    const room = currentRoom();
    if (!room || !room.recipients) return [];
    return room.recipients.map((id: string) => cache.getUser(id)).filter(Boolean);
  };

  const handleUserClick = (e: MouseEvent, id: string) => {
    setUserPopupTrigger(e.currentTarget as HTMLElement);
    setSelectedUserId(id);
    setUserPopupOpen(true);
  };

  return (
    <div class="flex flex-col h-full bg-[var(--background1)] p-2 overflow-y-auto">
      <Show when={members().length > 0}>
        <For each={members()}>{(member: any) => (
          <div
            class={`flex items-center gap-3 py-2 px-2 rounded hover:bg-surface hover:bg-opacity-10 cursor-pointer transition-colors ${
              userPopupOpen() && selectedUserId() === member.id 
                ? 'bg-surface bg-opacity-20' 
                : ''
            }`}
            onClick={e => handleUserClick(e, member.id)}
          >
            <Avatar
              userId={member.id}
              avatar={member.avatar}
              alt="User avatar"
              class=""
              size="sm"
            />
            <span class="font-medium truncate">{member.display_name || member.username}</span>
          </div>
        )}</For>
      </Show>
      <UserPopupMenu
        isOpen={userPopupOpen()}
        onClose={() => setUserPopupOpen(false)}
        triggerRef={userPopupTrigger()}
        userId={selectedUserId() || ""}
      />
    </div>
  );
};

export default MembersList;
