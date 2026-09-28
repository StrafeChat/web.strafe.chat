import type { Component } from 'solid-js';
import { Show, For, createMemo } from 'solid-js';
import { MessageAvatar } from './messageList/MessageAvatar';
import { UserBadges } from './UserBadges';
import { MessageBody } from './messageList/MessageBody';
import { PresenceDot } from './PresenceDot';
import { IconButton } from './ui/IconButton';
import { openReportDialog } from './ReportDialog';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { markdownAndHtmlToSanitizedBioHtml } from '../lib/profileRichText';
import {
  closeUserProfileFullModal,
  userProfileFullModal,
} from '../stores/userProfileFullModal';
import { openSafetyNumberModal } from '../stores/safetyNumberModal';
import { appSectionLabel } from '../theme/appChrome';
import { t } from '../i18n';

function formatDiscriminator(d: number): string {
  return String(d).padStart(4, '0');
}

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
    void navigator.clipboard.writeText(`${s.username}#${formatDiscriminator(s.discriminator)}`);
  }

  function copyUserId() {
    const s = subject();
    if (!s) return;
    void navigator.clipboard.writeText(s.userId);
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
          <div
            class="h-32 bg-gradient-to-br from-primary/60 via-primary/30 to-primary/10 bg-cover bg-center sm:h-36"
            style={{
              ...(subject()?.banner ? { 'background-image': `url(${subject()!.banner})` } : {}),
              ...(subject()?.banner
                ? {}
                : {
                    'background-image':
                      'radial-gradient(circle, rgba(255,255,255,0.14) 1px, transparent 1px)',
                    'background-size': '16px 16px',
                  }),
            }}
          />
          <div class="absolute end-3 top-3 flex items-center gap-2">
            <Show when={!isSelf() && userProfileFullModal.onMessageUser}>
              <IconButton
                size="lg"
                tone="overlay"
                icon="fa-solid fa-paper-plane"
                label={t('friends.actions.message')}
                onClick={() => {
                  const id = subject()?.userId;
                  const fn = userProfileFullModal.onMessageUser;
                  if (id && fn) {
                    closeUserProfileFullModal();
                    fn(id);
                  }
                }}
              />
            </Show>
            <Show when={!isSelf()}>
              <IconButton
                size="lg"
                tone="overlay"
                icon="fa-solid fa-shield-halved"
                label={t('safety.title')}
                onClick={() => {
                  const s = subject();
                  if (!s) return;
                  openSafetyNumberModal({ userId: s.userId, displayName: s.displayName });
                  closeUserProfileFullModal();
                }}
              />
            </Show>
            <Show when={!isSelf()}>
              <IconButton
                size="lg"
                tone="overlay"
                icon="fa-solid fa-flag"
                label={t('profile.report')}
                onClick={() => {
                  const s = subject();
                  if (!s) return;
                  closeUserProfileFullModal();
                  openReportDialog({ targetType: 'user', targetId: s.userId, targetName: s.displayName });
                }}
              />
            </Show>
            <IconButton size="lg" tone="overlay" icon="fa-regular fa-id-card" label={t('userArea.copyUserId')} onClick={copyUserId} />
            <IconButton size="lg" tone="overlay" icon="fa-solid fa-xmark" label={t('common.close')} onClick={() => closeUserProfileFullModal()} />
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
              <div class="flex flex-wrap items-center gap-2">
                <h2
                  id="user-profile-full-title"
                  class="break-words text-xl font-semibold leading-tight text-foreground"
                >
                  {subject()!.displayName}
                </h2>
                <UserBadges flags={subject()!.publicFlags} bot={subject()!.bot} size={16} />
              </div>
              <button
                type="button"
                onClick={copyTag}
                class="mt-1 flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {subject()!.username}#{formatDiscriminator(subject()!.discriminator)}
                <i class="fa-regular fa-copy text-[11px]" aria-hidden="true" />
              </button>
            </div>

            <Show when={subject()?.aboutMe?.trim()}>
              <div class="border-t border-border pt-4">
                <p class={`mb-2 ${appSectionLabel}`}>{t('settings.profile.aboutMe')}</p>
                <MessageBody
                  text={subject()!.aboutMe!.trim()}
                  class="break-words text-sm leading-relaxed text-foreground/95"
                />
              </div>
            </Show>

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

            <Show when={!subject()?.aboutMe?.trim() && !bioHtml()}>
              <div class="border-t border-border pt-4">
                <p class="text-sm text-muted-foreground">{t('profile.noBio')}</p>
              </div>
            </Show>

            <Show when={subject()?.spaceRoleNames?.length}>
              <div class="border-t border-border pt-4">
                <p class={`mb-2 ${appSectionLabel}`}>{t('profile.roles')}</p>
                <div class="flex flex-wrap gap-1.5">
                  <For each={subject()!.spaceRoleNames!}>
                    {(name) => (
                      <span class="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground">
                        {name}
                      </span>
                    )}
                  </For>
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
