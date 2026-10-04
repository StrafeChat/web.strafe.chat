import type { Component } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import { formatBirthday } from '../lib/utils/birthday';
import { appSectionLabel } from '../theme/appChrome';
import { t } from '../i18n';

/**
 * The "Birthday" fact row on a profile: label plus the month and day. Both profile surfaces
 * show it, and both need the same "only when it is there" rule - a person who has not opted
 * in has no birthday on their profile at all, so there is nothing to say.
 *
 * One component so the popover and the full modal can't drift on that, and so the raw
 * `"MM-DD"` is formatted at render time rather than when the subject was built: the popover
 * subject is captured when the card opens, and a label frozen there would stay in the old
 * language after a language change.
 */
export const ProfileBirthday: Component<{ birthday: string | undefined; class?: string }> = (props) => {
  const label = createMemo(() => formatBirthday(props.birthday));
  return (
    <Show when={label()}>
      {(date) => (
        <div class={props.class}>
          <p class={`mb-1.5 ${appSectionLabel}`}>{t('profile.birthday')}</p>
          <p class="text-sm text-foreground">{date()}</p>
        </div>
      )}
    </Show>
  );
};
