import type { Component } from 'solid-js';
import { Match, Show, Switch } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { UserBadges } from './UserBadges';
import { BotTag } from './BotTag';
import { appNameTagLine } from '../theme/appChrome';
import { isRemoteUser } from '../stores/instance';
import { t } from '../i18n';

/** How many badges draw before the rest fold into a `+N` chip. */
export const PROFILE_BADGE_CAP = 5;

export interface ProfileIdentityProps {
  displayName: string;
  username: string;
  homeDomain?: string;
  bot?: boolean;
  publicFlags?: number;
  /** The user's pronouns, shown under the name the way Discord does. */
  pronouns?: string;
  /** Today is their birthday - adds the 🎂 chip and a line under the tag. */
  isBirthday?: boolean;
  /** Hex colour for the name, from the member's highest hoisted role. */
  nameColor?: string;
  /** Heading level for the name - the popover card is an h3, the full profile an h2. */
  headingLevel?: 'h2' | 'h3';
  /** The popover card is narrow; the modal is not. */
  compact?: boolean;
  onCopyTag?: () => void;
  /** When set, the display name and the tag line become triggers that open the full
   * profile - the popover card does this (Discord's "click the name to open the profile");
   * the full profile itself does not. Takes the tag line over onCopyTag. */
  onOpenProfile?: () => void;
  /** Tooltip for those triggers, e.g. "View full profile". */
  openProfileLabel?: string;
  /** `id` on the name element, for a dialog's `labelledBy`. */
  id?: string;
}

/**
 * The identity block every profile surface shows: display name, BOT tag, the `@name`
 * tag, pronouns, the 🎂 birthday marker, and the badge row.
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
  const tag = () => props.username;
  return (
    <div class="flex flex-col gap-1.5">
      <Dynamic
        component={heading()}
        id={props.id}
        class={nameClass()}
        style={props.nameColor ? { color: props.nameColor } : undefined}
      >
        <Show when={props.onOpenProfile} fallback={props.displayName}>
          <button
            type="button"
            onClick={() => props.onOpenProfile?.()}
            data-tooltip={props.openProfileLabel}
            class="inline rounded-sm text-start hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {props.displayName}
          </button>
        </Show>
        <BotTag bot={props.bot} size={props.compact ? 'sm' : 'md'} class="relative -top-0.5" />
        <Show when={props.isBirthday}>
          <span
            class="ms-1.5 align-baseline text-sm"
            role="img"
            aria-label={t('profile.birthdayToday')}
            title={t('profile.birthdayToday')}
          >
            🎂
          </span>
        </Show>
      </Dynamic>

      <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Switch
          fallback={
            <span class={`truncate ${appNameTagLine}`} dir="ltr">
              {tag()}
            </span>
          }
        >
          <Match when={props.onOpenProfile}>
            <button
              type="button"
              onClick={() => props.onOpenProfile?.()}
              data-tooltip={props.openProfileLabel}
              class={`flex min-w-0 items-center gap-1.5 rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${appNameTagLine}`}
              dir="ltr"
            >
              <span class="truncate">{tag()}</span>
              <Show when={isRemoteUser({ home_domain: props.homeDomain })}>
                <span class="shrink-0 text-primary">@{props.homeDomain}</span>
              </Show>
            </button>
          </Match>
          <Match when={props.onCopyTag}>
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
          </Match>
        </Switch>

        <Show when={props.pronouns?.trim()}>
          <span class="shrink-0 text-xs text-muted-foreground">{props.pronouns!.trim()}</span>
        </Show>
      </div>

      <Show when={props.isBirthday}>
        <p class="text-xs font-medium text-primary">
          {t('profile.birthdayToday')}
        </p>
      </Show>

      <Show when={(props.publicFlags ?? 0) !== 0}>
        <UserBadges flags={props.publicFlags} size={props.compact ? 14 : 16} max={PROFILE_BADGE_CAP} />
      </Show>
    </div>
  );
};