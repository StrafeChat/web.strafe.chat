import type { Component } from 'solid-js';
import { Show, For, onMount, onCleanup, createEffect, createSignal, createMemo, createResource } from 'solid-js';
import { Portal } from 'solid-js/web';
import { MessageAvatar } from './messageList/MessageAvatar';
import { ProfileBanner } from './ProfileBanner';
import { ProfileIdentity } from './ProfileIdentity';
import { ProfileBirthday } from './ProfileBirthday';
import { ProfileConnections } from './ProfileConnections';
import { RolePill } from './RolePill';
import { MemberRolesEditor } from './MemberRolesEditor';
import { MessageBody } from './messageList/MessageBody';
import { PresenceDot } from './PresenceDot';
import { ProfileActivity } from './ActivityStatus';
import { activityOf } from '../stores/presence';
import { createPM } from '../api/rooms';
import { authorizeUrl, getPublicApplication } from '../api/developers';
import { sendMessage } from '../stores/messages';
import { addOrUpdateRoom } from '../stores/rooms';
import {
  closeUserProfilePopover,
  isUserProfilePopoverAnchor,
  remeasureUserProfilePopover,
  setUserProfilePopover,
  userProfilePopover,
} from '../stores/userProfilePopover';
import { memberNameColorHex, rolesForMemberProfile } from '../lib/userProfilePopoverHelpers';
import { openUserProfileFullModal } from '../stores/userProfileFullModal';
import { openSafetyNumberModal } from '../stores/safetyNumberModal';
import { openUserSettings } from '../stores/userSettingsModal';
import { openNicknameDialog } from '../stores/nicknameDialog';
import { IconButton } from './ui/IconButton';
import { appSectionLabel, zLayer } from '../theme/appChrome';
import { isMdViewport } from '../stores/mobileShellLayout';
import { t } from '../i18n';
import { openAppWindow } from '../lib/openWindow';
import { contextMenuState, showContextMenu } from '../stores/contextMenu';
import type { ContextMenuItem } from '../stores/contextMenu';
import { buildSpaceModerationItems, buildUserMenuItems } from '../lib/userContextMenu';

const EVERYONE_ROLE_NAME = '@everyone';
/** How many role pills to show before a “+N” overflow chip (popover is narrow). */
const MAX_ROLE_CHIPS_VISIBLE = 3;


/** Small dark circular button for the icon row over the banner - readable against any banner color/image, echoes the close button on the full profile modal. */
const BannerIconButton: Component<{
  icon: string;
  title: string;
  onClick: (e: MouseEvent) => void;
  id?: string;
  expanded?: boolean;
}> = (p) => (
  <button
    id={p.id}
    type="button"
    title={p.title}
    aria-label={p.title}
    aria-haspopup="menu"
    aria-expanded={p.expanded}
    class="flex size-8 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur transition-colors hover:bg-black/65 hover:text-white"
    onClick={(e) => p.onClick(e)}
  >
    <i class={`${p.icon} text-[13px]`} />
  </button>
);

export const UserProfilePopover: Component = () => {
  const [quickDraft, setQuickDraft] = createSignal('');
  const [quickSending, setQuickSending] = createSignal(false);
  const [quickError, setQuickError] = createSignal('');

  // A bot's user id is its application's client id, so its install link needs only the
  // id - but only offer the button once the application resolves (a bot from before ids
  // were shared, or whose application was deleted, has no consent page to open).
  const [botApp] = createResource(
    () => (userProfilePopover.open && subject()?.bot ? subject()!.userId : null),
    (id) => getPublicApplication(id).catch(() => null),
  );
  function addBotToSpace() {
    const s = subject();
    if (!s) return;
    openAppWindow(authorizeUrl({ clientId: s.userId, scopes: ['bot'] }));
    closeUserProfilePopover();
  }
  const [rootRef, setRootRef] = createSignal<HTMLDivElement>();

  function refreshPopoverHeight() {
    const el = rootRef();
    if (!el) return;
    queueMicrotask(() => remeasureUserProfilePopover(el.getBoundingClientRect().height));
  }

  const subject = () => userProfilePopover.subject;
  const roleEditCtx = () => userProfilePopover.spaceRoleContext;
  // Under the md breakpoint the card is a bottom-sheet drawer (with a dimmed backdrop)
  // instead of a floating popover anchored to the click - one surface, not a tiny card.
  const mobile = () => !isMdViewport();

  createEffect(() => {
    if (!userProfilePopover.open) {
      setQuickDraft('');
      setQuickError('');
    }
  });

  // The card's real height depends on which optional sections render (roles, about me,
  // join date) - the store places it using a rough guess for the first paint, then this
  // corrects the vertical placement once the actual height is known, so a tall card never
  // silently overflows or gets clipped against the viewport edge.
  createEffect(() => {
    if (!userProfilePopover.open) return;
    const el = rootRef();
    if (!el) return;
    // The activity card comes and goes live while the card is open (a game starts or ends).
    void !!activityOf(subject()?.userId);
    refreshPopoverHeight();
  });

  createEffect(() => {
    if (!userProfilePopover.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      closeUserProfilePopover();
    };
    document.addEventListener('keydown', onKey);
    onCleanup(() => document.removeEventListener('keydown', onKey));
  });

  onMount(() => {
    const onDoc = (e: MouseEvent) => {
      if (!userProfilePopover.open) return;
      const el = document.getElementById('user-profile-popover-root');
      const menu = document.getElementById('profile-role-add-menu');
      const actions = document.getElementById('context-menu-portal');
      const submenu = document.getElementById('context-submenu-portal');
      const target = e.target as Node;
      if (el?.contains(target) || menu?.contains(target) || actions?.contains(target) || submenu?.contains(target)) return;
      // Let the trigger's click decide: pressing the open trigger closes the card there, while
      // closing on mousedown first made it disappear for a frame and reopen on the same click.
      if (e.button === 0 && isUserProfilePopoverAnchor(target)) return;
      closeUserProfilePopover();
    };
    document.addEventListener('mousedown', onDoc, true);
    onCleanup(() => document.removeEventListener('mousedown', onDoc, true));
  });

  const isSelf = () => subject()?.userId === userProfilePopover.currentUserId;

  // Discord's rule: with Manage Roles you may change anyone's roles - your own, the owner's,
  // someone ranked above you - and what you may hand out or take away depends only on each
  // role's position (canChangeMemberRole), which the chips and the add menu apply.
  const canEditMemberRoles = createMemo(() => {
    const ctx = roleEditCtx();
    if (!ctx?.canManageMemberRoles || !subject()) return false;
    return ctx.spaceRoles.some((r) => r.name !== EVERYONE_ROLE_NAME);
  });
  const emptyRolesLabel = createMemo(() => {
    const ctx = roleEditCtx();
    if (!ctx || rolesForMemberProfile(ctx.subjectRoleIds, ctx.spaceRoles)?.length) return '';
    return canEditMemberRoles() ? t('profile.noRolesYetEditable') : t('profile.noRolesAssigned');
  });

  function handleRolesSaved(roleIds: string[]) {
    const ctx = roleEditCtx();
    if (!ctx) return;
    setUserProfilePopover('spaceRoleContext', 'subjectRoleIds', roleIds);
    setUserProfilePopover('subject', 'spaceRoles', rolesForMemberProfile(roleIds, ctx.spaceRoles));
    setUserProfilePopover('subject', 'nameColor', memberNameColorHex(roleIds, ctx.spaceRoles));
    ctx.onMemberRolesUpdated?.();
  }

  const showSpaceRolesRow = createMemo(() => !!roleEditCtx());
  const showRolesOrJoinSection = createMemo(
    () =>
      !!subject()?.joinedAtLabel ||
      showSpaceRolesRow() ||
      !!(subject()?.spaceRoles?.length && !roleEditCtx()),
  );


  function openActionsMenu(e: MouseEvent) {
    const s = subject();
    if (!s) return;
    const extraItems: ContextMenuItem[] = [];
    const moderation = userProfilePopover.spaceModerationContext;
    if (moderation) extraItems.push(...buildSpaceModerationItems(moderation));
    if (!isSelf() && !s.deleted) {
      extraItems.push({
        label: t('safety.title'),
        icon: 'fa-shield-halved',
        onClick: () => openSafetyNumberModal({ userId: s.userId, displayName: s.displayName }),
      });
    }
    const onMessageUser = userProfilePopover.onMessageUser;
    const items = buildUserMenuItems({
      userId: s.userId,
      deleted: s.deleted,
      username: s.username,
      displayName: s.displayName,
      homeDomain: s.homeDomain,
      currentUserId: userProfilePopover.currentUserId,
      bot: s.bot,
      spaceId: s.spaceId,
      onMessage:
        !isSelf() && onMessageUser
          ? (id) => onMessageUser(id)
          : undefined,
      extraItems,
    }).map((item) => ({
      ...item,
      onClick: (ev?: MouseEvent) => {
        closeUserProfilePopover();
        item.onClick(ev);
      },
    }));
    showContextMenu(e, items);
  }

  // Your own card, opened inside a space, leads to that space's profile editor - the quickest
  // way from "this is how I look here" to changing it.
  const showEditSpaceProfile = () => isSelf() && !!subject()?.spaceId;

  function editSpaceProfile() {
    const spaceId = subject()?.spaceId;
    if (!spaceId) return;
    closeUserProfilePopover();
    openUserSettings('spaceProfiles', { spaceId });
  }

  /** The space whose nickname the pencil edits: the role context's, which is what granted it. */
  const nicknameSpaceId = () => (roleEditCtx()?.canEditNickname ? roleEditCtx()?.spaceId : undefined);

  function editNickname() {
    const spaceId = nicknameSpaceId();
    const userId = subject()?.userId;
    if (!spaceId || !userId) return;
    // Closed first: the card is a snapshot taken when it opened, so it would keep showing the
    // old name, and the dialog's own clicks would close it anyway (they land outside it).
    closeUserProfilePopover();
    openNicknameDialog({ spaceId, userId });
  }

  /** Whether anything renders under the identity block, so the divider never trails empty. */
  const hasDetailSections = () =>
    !!activityOf(subject()?.userId) ||
    showEditSpaceProfile() ||
    !!(subject()?.bot && botApp()?.has_bot && botApp()?.bot_public) ||
    !!subject()?.aboutMe?.trim() ||
    !!subject()?.birthday ||
    showRolesOrJoinSection();

  function viewFullProfile() {
    const s = subject();
    // A deleted account has no profile left to open.
    if (!s || s.deleted) return;
    openUserProfileFullModal(
      {
        userId: s.userId,
        displayName: s.displayName,
        globalName: s.globalName,
        spaceId: s.spaceId,
        username: s.username,
        homeDomain: s.homeDomain,
        avatar: s.avatar,
        banner: s.banner,
        bio: s.bio,
        aboutMe: s.aboutMe,
        spaceRoles: s.spaceRoles,
        nameColor: s.nameColor,
        pronouns: s.pronouns,
        birthday: s.birthday,
        birthdayToday: s.birthdayToday,
        joinedAtLabel: s.joinedAtLabel,
        publicFlags: s.publicFlags,
        bot: s.bot,
        system: s.system,
      },
      {
        currentUserId: userProfilePopover.currentUserId,
        onMessageUser: userProfilePopover.onMessageUser,
        spaceRoleContext: roleEditCtx(),
      }
    );
    closeUserProfilePopover();
  }

  async function sendQuickMessage(e: Event) {
    e.preventDefault();
    const s = subject();
    const text = quickDraft().trim();
    if (!s || !text || quickSending()) return;
    setQuickSending(true);
    setQuickError('');
    try {
      const room = await createPM(s.userId);
      // A brand-new PM is announced over the gateway to the other person only, so put it in
      // our own rooms store here - sendMessage looks the room up there and quietly does nothing
      // when it is missing.
      addOrUpdateRoom(room);
      const sent = await sendMessage(room.id, text);
      if (!sent) {
        // Keep the draft and the popover open: nothing went out.
        setQuickError(t('room.sendFailed'));
        return;
      }
      setQuickDraft('');
      closeUserProfilePopover();
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : t('room.sendFailed'));
    } finally {
      setQuickSending(false);
    }
  }

  return (
    <Show when={userProfilePopover.open && subject()}>
      <Portal>
        <Show when={mobile()}>
          <div
            class={`fixed inset-0 ${zLayer.popover} bg-black/60 backdrop-blur-sm dialog-overlay-in`}
            onClick={() => closeUserProfilePopover()}
          />
        </Show>
        <div
          id="user-profile-popover-root"
          ref={setRootRef}
          data-modal
          class={`fixed ${zLayer.popover} flex max-h-[85vh] flex-col overflow-hidden border border-border bg-popover/95 shadow-2xl shadow-black/50 backdrop-blur-xl dialog-panel-in dialog-sheet inset-x-0 bottom-0 w-full rounded-t-3xl pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:bottom-auto md:w-[320px] md:rounded-3xl md:pb-0`}
          style={mobile() ? undefined : {
            left: `${userProfilePopover.left}px`,
            top: `${userProfilePopover.top}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Show when={mobile()}>
            <div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2" aria-hidden="true">
              <div class="h-1 w-10 rounded-sm bg-white/70 shadow-sm shadow-black/40" />
            </div>
          </Show>
          <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div class="relative">
              <ProfileBanner banner={subject()?.banner} class="h-20" />
              <div class="absolute end-2.5 top-2.5 flex items-center gap-1.5">
                <BannerIconButton
                  icon="fa-solid fa-ellipsis"
                  title={t('profile.moreActions')}
                  expanded={contextMenuState().open}
                  onClick={openActionsMenu}
                />
              </div>
              <div class="relative px-4 -mt-10">
                <button
                  type="button"
                  onClick={viewFullProfile}
                  disabled={subject()?.deleted === true}
                  aria-label={subject()?.deleted ? subject()!.displayName : t('profile.viewFull')}
                  data-tooltip={subject()?.deleted ? undefined : t('profile.viewFull')}
                  class="group/avatar relative inline-block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MessageAvatar
                    name={subject()!.displayName}
                    avatar={subject()!.avatar}
                    user={subject()}
                    class="size-20 border-4 border-popover bg-primary text-2xl font-semibold text-primary-foreground shadow-lg shadow-black/30 transition-opacity group-hover/avatar:opacity-90"
                  />
                  <span class="absolute bottom-0.5 end-0.5">
                    <PresenceDot userId={subject()!.userId} class="size-5" borderClass="border-popover" />
                  </span>
                </button>
              </div>
            </div>

            <div class="flex items-start gap-2 px-4 pb-1 pt-2.5">
              <div class="min-w-0 flex-1">
                <ProfileIdentity
                  headingLevel="h3"
                  compact
                  displayName={subject()!.displayName}
                  secondaryName={subject()!.globalName}
                  username={subject()!.username}
                  homeDomain={subject()!.homeDomain}
                  bot={subject()!.bot}
                  system={subject()!.system}
                  publicFlags={subject()!.publicFlags}
                  pronouns={subject()!.pronouns}
                  isBirthday={subject()!.birthdayToday}
                  nameColor={subject()!.nameColor}
                  onOpenProfile={subject()?.deleted ? undefined : viewFullProfile}
                  openProfileLabel={t('profile.viewFull')}
                />
              </div>
              <Show when={nicknameSpaceId()}>
                <IconButton
                  icon="fa-solid fa-pen"
                  label={t('spaceProfile.changeNickname')}
                  size="sm"
                  tone="subtle"
                  class="shrink-0"
                  onClick={editNickname}
                />
              </Show>
            </div>

            <Show when={hasDetailSections()}>
              <div class="mx-4 my-2.5 border-t border-border/60" />
            </Show>

            <ProfileActivity userId={subject()?.userId} class="px-4 pb-3" />

            <Show when={showEditSpaceProfile()}>
              <div class="px-4 pb-3">
                <button
                  type="button"
                  onClick={editSpaceProfile}
                  class="flex w-full items-center justify-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                >
                  <i class="fa-solid fa-id-badge text-xs" aria-hidden="true" />
                  {t('spaceProfile.edit')}
                </button>
              </div>
            </Show>

            <Show when={subject()?.bot && botApp()?.has_bot && botApp()?.bot_public}>
              <div class="px-4 pb-3">
                <button
                  type="button"
                  onClick={addBotToSpace}
                  class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  <i class="fa-solid fa-plus text-xs" aria-hidden="true" />
                  {t('profile.addToSpace')}
                </button>
              </div>
            </Show>

            <Show when={subject()?.aboutMe?.trim()}>
              <div class="px-4 pb-3">
                <p class={`mb-1.5 ${appSectionLabel}`}>{t('settings.profile.aboutMe')}</p>
                <MessageBody
                  text={subject()!.aboutMe!.trim()}
                  class="text-sm leading-relaxed text-foreground/95 break-words"
                />
              </div>
            </Show>

            <ProfileBirthday birthday={subject()?.birthday} class="px-4 pb-3" />

            <Show when={!subject()?.deleted}>
              <ProfileConnections userId={subject()?.userId} compact class="px-4 pb-3" />
            </Show>

            <Show when={showRolesOrJoinSection()}>
              <div class="space-y-2.5 px-4 pb-3">
                <Show when={roleEditCtx()}>
                  {(ctx) => (
                    <div>
                      <div class="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p class={appSectionLabel}>{t('profile.roles')}</p>
                        <Show when={emptyRolesLabel()}>
                          {(label) => <p class="text-xs text-muted-foreground">{label()}</p>}
                        </Show>
                      </div>
                      <MemberRolesEditor
                        spaceId={ctx().spaceId}
                        userId={subject()!.userId}
                        spaceRoles={ctx().spaceRoles}
                        roleIds={ctx().subjectRoleIds}
                        canManage={canEditMemberRoles()}
                        viewerHighestPosition={ctx().viewerHighestPosition}
                        maxVisible={MAX_ROLE_CHIPS_VISIBLE}
                        onSaved={handleRolesSaved}
                        onLayoutChange={refreshPopoverHeight}
                      />
                    </div>
                  )}
                </Show>

                <Show when={!showSpaceRolesRow() && subject()?.spaceRoles?.length}>
                  <div>
                    <p class={`mb-1.5 ${appSectionLabel}`}>{t('profile.roles')}</p>
                    <div class="flex flex-wrap gap-1.5">
                      <For each={subject()!.spaceRoles!}>{(role) => <RolePill role={role} />}</For>
                    </div>
                  </div>
                </Show>

                <Show when={subject()?.joinedAtLabel}>
                  <p class="text-xs text-muted-foreground">
                    <span class="font-medium text-foreground/90">{t('profile.joinedSpace')}</span>{' '}
                    <span>{subject()!.joinedAtLabel}</span>
                  </p>
                </Show>
              </div>
            </Show>

          </div>

          <Show when={!isSelf() && userProfilePopover.onMessageUser}>
            <form
              onSubmit={sendQuickMessage}
              class="shrink-0 border-t border-border/70 bg-popover/60 p-2.5"
            >
              <Show when={quickError()}>
                <p class="mb-1.5 px-1 text-xs text-destructive">{quickError()}</p>
              </Show>
              <div class="flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 py-1 ps-4 pe-1.5 focus-within:border-primary/50">
                <input
                  type="text"
                  value={quickDraft()}
                  onInput={(e) => setQuickDraft(e.currentTarget.value)}
                  placeholder={t('room.messageUser', { name: subject()?.displayName ?? '' })}
                  disabled={quickSending()}
                  class="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!quickDraft().trim() || quickSending()}
                  aria-label={t('common.send')}
                  class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary-hover disabled:opacity-40 disabled:hover:bg-primary"
                >
                  <i class="fa-solid fa-paper-plane text-[11px]" />
                </button>
              </div>
            </form>
          </Show>
        </div>
      </Portal>
    </Show>
  );
};
