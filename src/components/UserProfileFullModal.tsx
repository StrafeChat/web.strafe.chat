import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { MessageAvatar } from './messageList/MessageAvatar';
import { ProfileBanner } from './ProfileBanner';
import { ProfileIdentity } from './ProfileIdentity';
import { ProfileBirthday } from './ProfileBirthday';
import { RolePill } from './RolePill';
import { MemberRolesEditor } from './MemberRolesEditor';
import { PresenceDot } from './PresenceDot';
import { ProfileActivity } from './ActivityStatus';
import { EmptyState } from './ui/EmptyState';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import type { Relationship } from '../api/relationships';
import type { Space } from '../api/spaces';
import { markdownAndHtmlToSanitizedBioHtml } from '../lib/profileRichText';
import { memberNameColorHex, rolesForMemberProfile } from '../lib/userProfilePopoverHelpers';
import { profileSubjectFromRelationship } from '../lib/relationshipProfile';
import {
  closeUserProfileFullModal,
  openUserProfileFullModal,
  setUserProfileFullModal,
  userProfileFullModal,
} from '../stores/userProfileFullModal';
import { openSafetyNumberModal } from '../stores/safetyNumberModal';
import { contextMenuState, showContextMenu } from '../stores/contextMenu';
import type { ContextMenuItem } from '../stores/contextMenu';
import { buildUserMenuItems } from '../lib/userContextMenu';
import { spaceMembers, ensureSpaceMembers } from '../stores/spaceMembers';
import { spaces } from '../stores/spaces';
import { friendDisplayName, relationships, RelType } from '../stores/relationships';
import { appSectionLabel } from '../theme/appChrome';
import { t } from '../i18n';
import { formatHandle } from '../stores/instance';

const BannerIconButton: Component<{
  icon: string;
  title: string;
  onClick: (e: MouseEvent) => void;
  expanded?: boolean;
}> = (p) => (
  <button
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

const EVERYONE_ROLE_NAME = '@everyone';

type ProfileTab = 'profile' | 'friends' | 'spaces';

const ProfileTabBar: Component<{
  value: ProfileTab;
  onChange: (next: ProfileTab) => void;
  items: { id: ProfileTab; label: string }[];
}> = (props) => {
  let list: HTMLDivElement | undefined;
  let frame = 0;
  const buttons: Partial<Record<ProfileTab, HTMLButtonElement>> = {};
  const [indicator, setIndicator] = createSignal({ left: 0, width: 0 });

  const measure = () => {
    const active = buttons[props.value];
    if (!active) return;
    setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
  };

  const scheduleMeasure = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  };

  createEffect(() => {
    const active = buttons[props.value];
    if (!active) return;
    setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
  });

  onMount(() => {
    scheduleMeasure();
    const observer = new ResizeObserver(scheduleMeasure);
    if (list) observer.observe(list);
    for (const button of Object.values(buttons)) {
      if (button) observer.observe(button);
    }
    window.addEventListener('resize', scheduleMeasure);
    onCleanup(() => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    });
  });

  return (
    <div class="relative">
      <div
        ref={list}
        role="tablist"
        aria-label={t('profile.tabs.aria')}
        class="relative flex gap-5 overflow-x-auto border-b border-border md:gap-6"
      >
        <For each={props.items}>
          {(item) => (
            <button
              ref={(el) => {
                buttons[item.id] = el;
              }}
              type="button"
              role="tab"
              aria-selected={props.value === item.id}
              class={`relative shrink-0 whitespace-nowrap pb-3 pt-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                props.value === item.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => props.onChange(item.id)}
            >
              {item.label}
            </button>
          )}
        </For>
        <span
          class="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-primary transition-[left,width] duration-300 ease-out"
          style={{ left: `${indicator().left}px`, width: `${indicator().width}px` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

const MutualLoadingPanel: Component = () => (
  <div class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-8">
    <span class="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
    <p class="text-xs text-muted-foreground">{t('profile.mutual.loading')}</p>
  </div>
);

const MutualLoadWarning: Component<{ onRetry: () => void }> = (props) => (
  <div class="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
    <p class="min-w-0 text-xs text-amber-500">{t('profile.mutual.loadFailed')}</p>
    <button
      type="button"
      class="shrink-0 text-xs font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => props.onRetry()}
    >
      {t('profile.mutual.retry')}
    </button>
  </div>
);

const MutualFriendRow: Component<{ rel: Relationship; onOpen: () => void }> = (props) => (
  <button
    type="button"
    class="flex w-full cursor-pointer items-center gap-3 px-3.5 py-3 text-start transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    onClick={() => props.onOpen()}
  >
    <div class="relative shrink-0">
      <MessageAvatar
        name={friendDisplayName(props.rel)}
        avatar={props.rel.user.avatar}
        user={props.rel.user}
        class="size-9 text-[13px]"
      />
      <span class="absolute -bottom-px -end-px">
        <PresenceDot userId={props.rel.user.id} class="size-3.5" borderClass="border-card" />
      </span>
    </div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-foreground">{friendDisplayName(props.rel)}</p>
      <p class="truncate text-xs text-muted-foreground" dir="ltr">
        {formatHandle(props.rel.user)}
      </p>
    </div>
    <i class="fa-solid fa-chevron-right text-[10px] text-muted-foreground" aria-hidden="true" />
  </button>
);

const MutualSpaceRow: Component<{ space: Space; onOpen: () => void }> = (props) => {
  const name = () => props.space.name || t('space.unnamed');
  return (
    <button
      type="button"
      class="flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      aria-label={t('profile.mutual.openSpace', { name: name() })}
      onClick={() => props.onOpen()}
    >
      <MessageAvatar name={name()} avatar={props.space.icon} initial class="size-9 text-xs" />
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-medium text-foreground">{name()}</span>
        <span class="block truncate text-xs text-muted-foreground">
          {props.space.description?.trim() || t('profile.mutual.sharedSpace')}
        </span>
      </span>
      <i class="fa-solid fa-chevron-right text-[10px] text-muted-foreground" aria-hidden="true" />
    </button>
  );
};

export const UserProfileFullModal: Component = () => {
  const navigate = useNavigate();
  const subject = () => userProfileFullModal.subject;
  const isSelf = () => subject()?.userId === userProfileFullModal.currentUserId;
  const roleEditCtx = () => userProfileFullModal.spaceRoleContext;
  const [tab, setTab] = createSignal<ProfileTab>('profile');
  const activeTab = (): ProfileTab =>
    isSelf() || (subject()?.bot && tab() === 'friends') ? 'profile' : tab();
  const [mutualLoading, setMutualLoading] = createSignal(false);
  const [mutualLoadedFor, setMutualLoadedFor] = createSignal<string | null>(null);
  const [mutualFailures, setMutualFailures] = createSignal(0);
  let mutualLoadToken = 0;

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
  const showRolesSection = createMemo(
    () => !!roleEditCtx() || !!subject()?.spaceRoles?.length,
  );

  const sharedSpaces = createMemo(() => {
    const targetId = subject()?.userId;
    if (!targetId) return [];
    return spaces.spaces.filter((space) =>
      (spaceMembers.bySpaceId[space.id] ?? []).some((member) => member.id === targetId),
    );
  });

  const mutualFriends = createMemo(() => {
    const targetId = subject()?.userId;
    const shared = sharedSpaces();
    if (!targetId || shared.length === 0) return [];

    const friendIds = new Set(
      relationships.relationships
        .filter((rel) => rel.type === RelType.Friend && rel.user.id !== targetId)
        .map((rel) => rel.user.id),
    );
    if (friendIds.size === 0) return [];

    const sharedFriendIds = new Set<string>();
    for (const space of shared) {
      for (const member of spaceMembers.bySpaceId[space.id] ?? []) {
        if (friendIds.has(member.id)) sharedFriendIds.add(member.id);
      }
    }
    return relationships.relationships.filter(
      (rel) => rel.type === RelType.Friend && sharedFriendIds.has(rel.user.id),
    );
  });

  const tabItems = (): { id: ProfileTab; label: string }[] => {
    const loaded = mutualLoadedFor() === subject()?.userId;
    const items: { id: ProfileTab; label: string }[] = [
      { id: 'profile', label: t('profile.tabs.profile') },
    ];
    // Bots cannot be friends, so a bot's profile has no mutual-friends tab.
    if (!subject()?.bot) {
      items.push({
        id: 'friends',
        label: loaded
          ? `${t('profile.tabs.mutualFriends')} (${mutualFriends().length})`
          : t('profile.tabs.mutualFriends'),
      });
    }
    items.push({
      id: 'spaces',
      label: loaded
        ? `${t('profile.tabs.mutualSpaces')} (${sharedSpaces().length})`
        : t('profile.tabs.mutualSpaces'),
    });
    return items;
  };

  // A new subject starts on the profile tab with no stale shared-space result.
  let lastSubjectId: string | null = null;
  createEffect(() => {
    const id = subject()?.userId ?? null;
    if (id === lastSubjectId) return;
    lastSubjectId = id;
    mutualLoadToken++;
    setTab('profile');
    setMutualLoadedFor(null);
    setMutualFailures(0);
    setMutualLoading(false);
  });

  // Member lists are the only user-space source the API has. Fetch them when another
  // profile opens so the tab counts can appear; ensureSpaceMembers reuses loaded lists.
  createEffect(() => {
    const current = subject();
    if (!userProfileFullModal.open || !current || isSelf()) return;
    if (mutualLoading() || mutualLoadedFor() === current.userId) return;
    void loadMutualData(current.userId);
  });

  async function loadMutualData(userId: string): Promise<void> {
    const token = ++mutualLoadToken;
    setMutualLoading(true);
    setMutualFailures(0);
    const results = await Promise.allSettled(spaces.spaces.map((space) => ensureSpaceMembers(space.id)));
    if (token !== mutualLoadToken) return;
    setMutualFailures(results.filter((result) => result.status === 'rejected').length);
    setMutualLoadedFor(userId);
    setMutualLoading(false);
  }

  function retryMutualData() {
    setMutualFailures(0);
    setMutualLoadedFor(null);
  }

  function openMutualSpace(spaceId: string) {
    closeUserProfileFullModal();
    navigate(`/spaces/${spaceId}`);
  }

  function openMutualFriend(rel: Relationship) {
    openUserProfileFullModal(profileSubjectFromRelationship(rel), {
      currentUserId: userProfileFullModal.currentUserId,
      onMessageUser: userProfileFullModal.onMessageUser,
    });
  }

  function handleRolesSaved(roleIds: string[]) {
    const ctx = roleEditCtx();
    if (!ctx) return;
    setUserProfileFullModal('spaceRoleContext', 'subjectRoleIds', roleIds);
    setUserProfileFullModal('subject', 'spaceRoles', rolesForMemberProfile(roleIds, ctx.spaceRoles));
    setUserProfileFullModal('subject', 'nameColor', memberNameColorHex(roleIds, ctx.spaceRoles));
    ctx.onMemberRolesUpdated?.();
  }

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
        deleted: s.deleted,
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
        panelClass="overflow-hidden md:max-h-[min(88vh,680px)]"
      >
        <div class="relative shrink-0">
          <ProfileBanner banner={subject()?.banner} class="h-32 w-full" />
          <div class="absolute end-2.5 top-2.5 z-10 flex items-center gap-1.5">
            <BannerIconButton
              icon="fa-solid fa-ellipsis"
              title={t('profile.moreActions')}
              expanded={contextMenuState().open}
              onClick={openActionsMenu}
            />
          </div>
          <div class="relative -mt-12 px-6">
            <div class="relative inline-block">
              <MessageAvatar
                name={subject()!.displayName}
                avatar={subject()!.avatar}
                user={subject()}
                class="size-24 border-4 border-card bg-primary text-2xl font-semibold text-primary-foreground shadow-lg shadow-black/30"
              />
              <span class="absolute bottom-1 end-1">
                <PresenceDot userId={subject()!.userId} class="size-5" borderClass="border-card" />
              </span>
            </div>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 md:pb-6">
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

            <Show when={!isSelf()}>
              <div class="pt-1">
                <ProfileTabBar value={tab()} onChange={(next) => setTab(next)} items={tabItems()} />
              </div>
            </Show>

            <div class={isSelf() ? '' : 'h-[clamp(14rem,30dvh,18rem)] overflow-y-auto overscroll-contain'}>
              <Switch>
                <Match when={activeTab() === 'profile'}>
                <div class="flex flex-col gap-4">
                  <Show when={bioHtml()}>
                    <div class={`pt-4 ${isSelf() ? 'border-t border-border' : ''}`}>
                      <p class={`mb-2 ${appSectionLabel}`}>{t('settings.profile.bio')}</p>
                      <div
                        class="bio-rich text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted/50 [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                        // eslint-disable-next-line solid/no-innerhtml -- DOMPurify-sanitised in lib/profileRichText.ts
                        innerHTML={bioHtml()}
                      />
                    </div>
                  </Show>

                  <Show when={!bioHtml()}>
                    <div class={`pt-4 ${isSelf() ? 'border-t border-border' : ''}`}>
                      <p class="text-sm text-muted-foreground">{t('profile.noBio')}</p>
                    </div>
                  </Show>

                  <Show when={showRolesSection()}>
                    <div class="border-t border-border pt-4">
                      <div class="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p class={appSectionLabel}>{t('profile.roles')}</p>
                        <Show when={emptyRolesLabel()}>
                          {(label) => <p class="text-xs text-muted-foreground">{label()}</p>}
                        </Show>
                      </div>
                      <Show
                        when={roleEditCtx()}
                        fallback={
                          <Show
                            when={subject()?.spaceRoles?.length}
                            fallback={<p class="text-xs text-muted-foreground">{t('profile.noRolesAssigned')}</p>}
                          >
                            <div class="flex flex-wrap gap-1.5">
                              <For each={subject()!.spaceRoles!}>{(role) => <RolePill role={role} />}</For>
                            </div>
                          </Show>
                        }
                      >
                        {(ctx) => (
                          <MemberRolesEditor
                            spaceId={ctx().spaceId}
                            userId={subject()!.userId}
                            spaceRoles={ctx().spaceRoles}
                            roleIds={ctx().subjectRoleIds}
                            canManage={canEditMemberRoles()}
                            viewerHighestPosition={ctx().viewerHighestPosition}
                            onSaved={handleRolesSaved}
                          />
                        )}
                      </Show>
                    </div>
                  </Show>

                  <Show when={subject()?.joinedAtLabel}>
                    <p class="border-t border-border pt-4 text-xs text-muted-foreground">
                      <span class="font-medium text-foreground/90">{t('profile.joinedSpace')}</span>{' '}
                      <span>{subject()!.joinedAtLabel}</span>
                    </p>
                  </Show>
                </div>
              </Match>

                <Match when={activeTab() === 'friends'}>
                <Show when={mutualLoading()} fallback={
                  <div class="flex flex-col gap-3">
                    <Show when={mutualFailures() > 0}>
                      <MutualLoadWarning onRetry={retryMutualData} />
                    </Show>
                    <Show
                      when={mutualFriends().length > 0}
                      fallback={
                        <EmptyState
                          icon="fa-solid fa-user-group"
                          title={t('profile.mutual.friendsEmptyTitle')}
                          body={t('profile.mutual.friendsEmptyBody', { name: subject()!.displayName })}
                        />
                      }
                    >
                      <div class="overflow-hidden rounded-xl border border-border/70 bg-card/20">
                        <div class="divide-y divide-border/40">
                          <For each={mutualFriends()}>
                            {(rel) => (
                              <MutualFriendRow rel={rel} onOpen={() => openMutualFriend(rel)} />
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>
                  </div>
                }>
                  <MutualLoadingPanel />
                </Show>
              </Match>

                <Match when={activeTab() === 'spaces'}>
                <Show when={mutualLoading()} fallback={
                  <div class="flex flex-col gap-3">
                    <Show when={mutualFailures() > 0}>
                      <MutualLoadWarning onRetry={retryMutualData} />
                    </Show>
                    <Show
                      when={sharedSpaces().length > 0}
                      fallback={
                        <EmptyState
                          icon="fa-solid fa-layer-group"
                          title={t('profile.mutual.spacesEmptyTitle')}
                          body={t('profile.mutual.spacesEmptyBody', { name: subject()!.displayName })}
                        />
                      }
                    >
                      <div class="overflow-hidden rounded-xl border border-border/70 bg-card/20">
                        <div class="divide-y divide-border/40">
                          <For each={sharedSpaces()}>
                            {(space) => (
                              <MutualSpaceRow space={space} onOpen={() => openMutualSpace(space.id)} />
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>
                  </div>
                }>
                  <MutualLoadingPanel />
                </Show>
              </Match>
              </Switch>
            </div>
          </div>
        </div>
      </ResponsiveDialog>
    </Show>
  );
};