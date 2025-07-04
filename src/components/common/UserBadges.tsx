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

// Badge icon mapping for user flags
const BADGE_ICONS: Record<string, { icon: string; name: string }> = {
  "founder": { icon: "/assets/badges/founder.svg", name: "Founder" },
  "platform_admin": { icon: "/assets/badges/platform_admin.svg", name: "Platform Admin" },
  "platform_mod": { icon: "/assets/badges/platform_mod.svg", name: "Platform Moderator" },
  "contributor": { icon: "/assets/badges/contributor.svg", name: "Contributor" },
  "translator": { icon: "/assets/badges/translator.svg", name: "Translator" },
  "bug_reporter": { icon: "/assets/badges/bug_reporter.svg", name: "Bug Reporter" },
  "early_supporter": { icon: "/assets/badges/early_supporter.svg", name: "Early Supporter" },
  "supporter": { icon: "/assets/badges/supporter.svg", name: "Supporter" },
  "early_adopter": { icon: "/assets/badges/early_adopter.svg", name: "Early Adopter" },
  "bot_developer": { icon: "/assets/badges/bot_developer.svg", name: "Bot Developer" },
  // Legacy badges
  "staff": { icon: "/assets/badges/staff.svg", name: "Staff" },
  "verified": { icon: "/assets/badges/verified.svg", name: "Verified" },
  "bug_hunter": { icon: "/assets/badges/bug_hunter.svg", name: "Bug Hunter" },
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
