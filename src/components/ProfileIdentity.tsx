import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { UserBadges } from './UserBadges';
import { BotTag } from './BotTag';
import { appNameTagLine } from '../theme/appChrome';
import { isRemoteUser } from '../stores/instance';

/** How many badges draw before the rest fold into a `+N` chip. */
export const PROFILE_BADGE_CAP = 5;

function formatDiscriminator(d: number): string {
  return String(d).padStart(4, '0');
}

export interface ProfileIdentityProps {
  displayName: string;
  username: string;
  discriminator: number;
  homeDomain?: string;
  bot?: boolean;
  publicFlags?: number;
  /** The user's pronouns, shown under the name the way Discord does. */
  pronouns?: string;
  /** Hex colour for the name, from the member's highest hoisted role. */
  nameColor?: string;
  /** Heading level for the name - the popover card is an h3, the full profile an h2. */
  headingLevel?: 'h2' | 'h3';
  /** The popover card is narrow; the modal is not. */
  compact?: boolean;
  onCopyTag?: () => void;
  /** `id` on the name element, for a dialog's `labelledBy`. */
  id?: string;
}

/**
 * The identity block every profile surface shows: display name, BOT tag, the `@name#0001`
 * tag, and the badge row.
 *
 * One component because these used to be written out three times and drift: the badge row
 * moved between being a sibling of the heading and part of a wrapping flex row, so the same
 * person had a different header on the popover than in the full profile, and a badge-heavy
 * account pushed the name into a wrap on one surface and not the other.
 *
 * The name is the point of the block, so it gets the whole line: badges go on their own row
 * underneath, capped, and never squeeze it. Colour comes from the member's highest hoisted
 * role when they have one.
 */
export const ProfileIdentity: Component<ProfileIdentityProps> = (props) => {
  const heading = () => (props.headingLevel === 'h2' ? 'h2' : 'h3');
  const nameClass = () =>
    `min-w-0 break-words font-semibold leading-tight ${props.compact ? 'text-lg' : 'text-xl'}`;
  const tag = () => `${props.username}#${formatDiscriminator(props.discriminator)}`;
  return (
    <div class="flex flex-col gap-1.5">
      <Dynamic
        component={heading()}
        id={props.id}
        class={nameClass()}
        style={props.nameColor ? { color: props.nameColor } : undefined}
      >
        {props.displayName}
        <BotTag bot={props.bot} size={props.compact ? 'sm' : 'md'} class="relative -top-0.5" />
      </Dynamic>

      <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Show
          when={props.onCopyTag}
          fallback={
            <span class={`truncate ${appNameTagLine}`} dir="ltr">
              {tag()}
            </span>
          }
        >
          <button
            type="button"
            onClick={() => props.onCopyTag?.()}
            class={`flex min-w-0 items-center gap-1.5 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${appNameTagLine}`}
            dir="ltr"
          >
            <span class="truncate">{tag()}</span>
            <Show when={isRemoteUser({ home_domain: props.homeDomain })}>
              <span class="shrink-0 text-primary">@{props.homeDomain}</span>
            </Show>
            <i class="fa-regular fa-copy shrink-0 text-[10px]" aria-hidden="true" />
          </button>
        </Show>

        <Show when={props.pronouns?.trim()}>
          <span class="shrink-0 text-xs text-muted-foreground">{props.pronouns!.trim()}</span>
        </Show>
      </div>

      <Show when={(props.publicFlags ?? 0) !== 0}>
        <UserBadges flags={props.publicFlags} size={props.compact ? 14 : 16} max={PROFILE_BADGE_CAP} />
      </Show>
    </div>
  );
};