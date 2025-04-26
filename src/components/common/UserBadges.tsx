import { Component, For, Show } from "solid-js";

interface Badge {
  id: string;
  name: string;
  icon: string; // URL or local asset path
  tooltip?: string;
}

interface UserBadgesProps {
  badges: Badge[] | undefined;
}

// Example badge icon mapping (replace with your own as needed)
const BADGE_ICONS: Record<string, { icon: string; name: string }> = {
  "staff": { icon: "/assets/badges/staff.svg", name: "Staff" },
  "verified": { icon: "/assets/badges/verified.svg", name: "Verified" },
  "bug_hunter": { icon: "/assets/badges/bug_hunter.svg", name: "Bug Hunter" },
  // Add more badges as needed
};

export const UserBadges: Component<UserBadgesProps> = (props) => (
  <Show when={props.badges && props.badges.length > 0}>
    <div class="flex gap-1 mt-1">
      <For each={props.badges}>
        {(badge) => {
          const badgeInfo = BADGE_ICONS[badge.id] || { icon: badge.icon, name: badge.name };
          return (
            <img
              src={badgeInfo.icon}
              alt={badgeInfo.name}
              title={badgeInfo.name}
              class="w-6 h-6 rounded"
              loading="lazy"
            />
          );
        }}
      </For>
    </div>
  </Show>
);

export default UserBadges;
