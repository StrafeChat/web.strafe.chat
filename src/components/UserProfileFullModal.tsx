import type { Component } from 'solid-js';
import { Show, For, createMemo } from 'solid-js';
import { MessageAvatar } from './messageList/MessageAvatar';
import { ProfileBanner } from './ProfileBanner';
import { ProfileIdentity } from './ProfileIdentity';
import { ProfileBirthday } from './ProfileBirthday';
import { RolePill } from './RolePill';
import { PresenceDot } from './PresenceDot';
import { ProfileActivity } from './ActivityStatus';
import { IconButton } from './ui/IconButton';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { markdownAndHtmlToSanitizedBioHtml } from '../lib/profileRichText';
import {
  closeUserProfileFullModal,
  userProfileFullModal,
} from '../stores/userProfileFullModal';
import { openSafetyNumberModal } from '../stores/safetyNumberModal';
import { contextMenuState, showContextMenu } from '../stores/contextMenu';
import type { ContextMenuItem } from '../stores/contextMenu';
import { buildUserMenuItems } from '../lib/userContextMenu';
import { appSectionLabel } from '../theme/appChrome';
import { t } from '../i18n';
import { formatHandle } from '../stores/instance';

export const UserProfileFullModal: Component = () => {
  const subject = () => userProfileFullModal.subject;
  const isSelf = () => subject()?.userId === userProfileFullModal.currentUserId;

  const bioHtml = createMemo(() => {
    const b = subject()?.bio?.trim();
    if (!b) return '';
    return markdownAndHtmlToSanitizedBioHtml(b);
  });

  function copyTag() {
    const s = subject();
    if (!s) return;
    void navigator.clipboard.writeText(formatHandle({ username: s.username, home_domain: s.homeDomain }));
  }

  function openActionsMenu(e: MouseEvent) {
    const s = subject();
    if (!s) return;
    const extraItems: ContextMenuItem[] = [];
    if (!isSelf()) {
      extraItems.push({
        label: t('safety.title'),
        icon: 'fa-shield-halved',
        onClick: () => {
          openSafetyNumberModal({ userId: s.userId, displayName: s.displayName });
          closeUserProfileFullModal();
        },
      });
    }
    extraItems.push({ label: t('common.close'), icon: 'fa-xmark', onClick: () => closeUserProfileFullModal() });

    showContextMenu(
      e,
      buildUserMenuItems({
        userId: s.userId,
        username: s.username,
        displayName: s.displayName,
        homeDomain: s.homeDomain,
        currentUserId: userProfileFullModal.currentUserId,
        bot: s.bot,
        spaceId: s.spaceId,
        onMessage:
          !isSelf() && userProfileFullModal.onMessageUser
            ? (id) => {
                const fn = userProfileFullModal.onMessageUser;
                closeUserProfileFullModal();
                fn?.(id);
              }
            : undefined,
        extraItems,
      }),
    );
  }

  return (
    <Show when={userProfileFullModal.open && subject()}>
      <ResponsiveDialog
        size="lg"
        onClose={closeUserProfileFullModal}
        labelledBy="user-profile-full-title"
        unpadded
        panelClass="md:max-h-[min(88vh,680px)]"
      >
        <div class="relative shrink-0">
          <ProfileBanner banner={subject()?.banner} class="max-h-36 sm:max-h-44" fit="natural" />
          <div class="absolute end-3 top-3 flex items-center gap-2">
            <IconButton
              size="lg"
              tone="overlay"
              icon="fa-solid fa-ellipsis"
              label={t('profile.moreActions')}
              aria-haspopup="menu"
              aria-expanded={contextMenuState().open}
              onClick={openActionsMenu}
            />
          </div>
          <div class="relative -mt-12 px-6">
            <div class="relative inline-block">
              <MessageAvatar
                name={subject()!.displayName}
                avatar={subject()!.avatar}
                class="size-24 border-4 border-card bg-primary text-2xl font-semibold text-primary-foreground shadow-lg"
              />
              <span class="absolute bottom-1 end-1">
                <PresenceDot userId={subject()!.userId} class="size-5" borderClass="border-card" />
              </span>
            </div>
          </div>
        </div>

        <div class="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 md:pb-6">
          <div class="flex flex-col gap-4">
            <div>
              <ProfileIdentity
                headingLevel="h2"
                id="user-profile-full-title"
                displayName={subject()!.displayName}
                secondaryName={subject()!.globalName}
                username={subject()!.username}
                homeDomain={subject()!.homeDomain}
                alwaysShowDomain
                bot={subject()!.bot}
                system={subject()!.system}
                publicFlags={subject()!.publicFlags}
                pronouns={subject()!.pronouns}
                isBirthday={subject()!.birthdayToday}
                nameColor={subject()!.nameColor}
                onCopyTag={copyTag}
              />
            </div>

            <ProfileActivity userId={subject()?.userId} />

            <ProfileBirthday birthday={subject()?.birthday} />

            <Show when={bioHtml()}>
              <div class="border-t border-border pt-4">
                <p class={`mb-2 ${appSectionLabel}`}>{t('settings.profile.bio')}</p>
                <div
                  class="bio-rich text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted/50 [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                  // eslint-disable-next-line solid/no-innerhtml -- DOMPurify-sanitised in lib/profileRichText.ts
                  innerHTML={bioHtml()}
                />
              </div>
            </Show>

            <Show when={!bioHtml()}>
              <div class="border-t border-border pt-4">
                <p class="text-sm text-muted-foreground">{t('profile.noBio')}</p>
              </div>
            </Show>

            <Show when={subject()?.spaceRoles?.length}>
              <div class="border-t border-border pt-4">
                <p class={`mb-2 ${appSectionLabel}`}>{t('profile.roles')}</p>
                <div class="flex flex-wrap gap-1.5">
                  <For each={subject()!.spaceRoles!}>{(role) => <RolePill role={role} />}</For>
                </div>
              </div>
            </Show>

            <Show when={subject()?.joinedAtLabel}>
              <p class="border-t border-border pt-4 text-xs text-muted-foreground">
                <span class="font-medium text-foreground/90">{t('profile.joinedSpace')}</span>{' '}
                <span>{subject()!.joinedAtLabel}</span>
              </p>
            </Show>
          </div>
        </div>
      </ResponsiveDialog>
    </Show>
  );
};
