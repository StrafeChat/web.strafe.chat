import type { Component } from 'solid-js';
import { Show, For, onMount, onCleanup, createEffect, createSignal, createMemo, createResource } from 'solid-js';
import { Portal } from 'solid-js/web';
import { MessageAvatar } from './messageList/MessageAvatar';
import { ProfileIdentity } from './ProfileIdentity';
import { RolePill } from './RolePill';
import { MessageBody } from './messageList/MessageBody';
import { PresenceDot } from './PresenceDot';
import { createPM } from '../api/rooms';
import { authorizeUrl, getPublicApplication } from '../api/developers';
import { sendMessage } from '../stores/messages';
import {
  closeUserProfilePopover,
  remeasureUserProfilePopover,
  setUserProfilePopover,
  userProfilePopover,
} from '../stores/userProfilePopover';
import { memberNameColorHex, rolesForMemberChips, rolesForMemberProfile } from '../lib/userProfilePopoverHelpers';
import { openUserProfileFullModal } from '../stores/userProfileFullModal';
import { openSafetyNumberModal } from '../stores/safetyNumberModal';
import { setMemberSpaceRoles } from '../api/spaces';
import type { SpaceRole } from '../api/spaces';
import { spaceRoleColorHex } from '../lib/spacePermissions';
import { appMenuItemDefault, appMenuPanel, appSectionLabel, zLayer } from '../theme/appChrome';
import { isMdViewport } from '../stores/mobileShellLayout';
import { t } from '../i18n';

const EVERYONE_ROLE_NAME = '@everyone';
/** How many role pills to show before a “+N” overflow chip (popover is narrow). */
const MAX_ROLE_CHIPS_VISIBLE = 3;

function formatDiscriminator(d: number): string {
  return String(d).padStart(4, '0');
}

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
    aria-expanded={p.expanded}
    class="flex size-8 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur transition-colors hover:bg-black/65 hover:text-white"
    onClick={(e) => p.onClick(e)}
  >
    <i class={`${p.icon} text-[13px]`} />
  </button>
);

export const UserProfilePopover: Component = () => {
  const [pickedCustomRoleIds, setPickedCustomRoleIds] = createSignal<Set<string>>(new Set());
  const [roleSaveBusy, setRoleSaveBusy] = createSignal(false);
  const [roleSaveErr, setRoleSaveErr] = createSignal('');
  const [addRolesMenuOpen, setAddRolesMenuOpen] = createSignal(false);
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
    window.open(authorizeUrl({ clientId: s.userId, scopes: ['bot'] }), '_blank', 'noopener');
    closeUserProfilePopover();
  }
  const [rootRef, setRootRef] = createSignal<HTMLDivElement>();

  const subject = () => userProfilePopover.subject;
  const roleEditCtx = () => userProfilePopover.spaceRoleContext;
  // Under the md breakpoint the card is a bottom-sheet drawer (with a dimmed backdrop)
  // instead of a floating popover anchored to the click - one surface, not a tiny card.
  const mobile = () => !isMdViewport();

  function revertPickedFromContext() {
    const ctx = roleEditCtx();
    if (!ctx) {
      setPickedCustomRoleIds(new Set<string>());
      return;
    }
    const everyoneId = ctx.spaceRoles.find((r) => r.name === EVERYONE_ROLE_NAME)?.id;
    const next = new Set<string>();
    for (const rid of ctx.subjectRoleIds) {
      if (rid && rid !== everyoneId) next.add(rid);
    }
    setPickedCustomRoleIds(next);
  }

  createEffect(() => {
    if (!userProfilePopover.open) {
      setPickedCustomRoleIds(new Set<string>());
      setRoleSaveErr('');
      setAddRolesMenuOpen(false);
      setQuickDraft('');
      setQuickError('');
      return;
    }
    const ctx = userProfilePopover.spaceRoleContext;
    if (!ctx) {
      setPickedCustomRoleIds(new Set<string>());
      return;
    }
    revertPickedFromContext();
    setRoleSaveErr('');
  });

  // The card's real height depends on which optional sections render (roles, about me,
  // join date) - the store places it using a rough guess for the first paint, then this
  // corrects the vertical placement once the actual height is known, so a tall card never
  // silently overflows or gets clipped against the viewport edge.
  createEffect(() => {
    if (!userProfilePopover.open) return;
    const el = rootRef();
    if (!el) return;
    // Re-run whenever content that changes height changes.
    addRolesMenuOpen();
    void displayedSortedRoles().length;
    queueMicrotask(() => remeasureUserProfilePopover(el.getBoundingClientRect().height));
  });

  createEffect(() => {
    if (!userProfilePopover.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (addRolesMenuOpen()) {
        e.stopPropagation();
        setAddRolesMenuOpen(false);
        return;
      }
      closeUserProfilePopover();
    };
    document.addEventListener('keydown', onKey);
    onCleanup(() => document.removeEventListener('keydown', onKey));
  });

  createEffect(() => {
    if (!addRolesMenuOpen()) return;
    const onDoc = (e: MouseEvent) => {
      const menu = document.getElementById('profile-role-add-menu');
      const btn = document.getElementById('profile-role-add-btn');
      const t = e.target as Node;
      if (menu?.contains(t) || btn?.contains(t)) return;
      setAddRolesMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc, true);
    onCleanup(() => document.removeEventListener('mousedown', onDoc, true));
  });

  onMount(() => {
    const onDoc = (e: MouseEvent) => {
      if (!userProfilePopover.open) return;
      const el = document.getElementById('user-profile-popover-root');
      const t = e.target as Node;
      if (el?.contains(t)) return;
      closeUserProfilePopover();
    };
    document.addEventListener('mousedown', onDoc, true);
    onCleanup(() => document.removeEventListener('mousedown', onDoc, true));
  });

  const isSelf = () => subject()?.userId === userProfilePopover.currentUserId;

  const canEditMemberRoles = createMemo(() => {
    const ctx = roleEditCtx();
    const s = subject();
    if (!ctx?.canManageMemberRoles || !s) return false;
    // Only the owner may change the owner's roles - and they may, on themselves, which is
    // how the owner gives themselves a colour or a hoisted title.
    if (s.userId === ctx.spaceOwnerId && s.userId !== userProfilePopover.currentUserId) return false;
    return ctx.spaceRoles.some((r) => r.name !== EVERYONE_ROLE_NAME);
  });

  const displayedSortedRoles = createMemo((): SpaceRole[] => {
    const ctx = roleEditCtx();
    if (!ctx) return [];
    if (canEditMemberRoles()) {
      const byId = new Map(ctx.spaceRoles.map((r) => [r.id, r]));
      const list: SpaceRole[] = [];
      for (const id of pickedCustomRoleIds()) {
        const r = byId.get(id);
        if (r && r.name !== EVERYONE_ROLE_NAME) list.push(r);
      }
      list.sort((a, b) => b.position - a.position);
      return list;
    }
    return rolesForMemberChips(ctx.subjectRoleIds, ctx.spaceRoles);
  });

  const visibleRoleChips = createMemo(() =>
    displayedSortedRoles().slice(0, MAX_ROLE_CHIPS_VISIBLE),
  );
  const hiddenRoleChipCount = createMemo(() =>
    Math.max(0, displayedSortedRoles().length - MAX_ROLE_CHIPS_VISIBLE),
  );

  /** Roles at or above this the viewer may neither add nor take away (Infinity = owner). */
  const roleCeiling = () => roleEditCtx()?.viewerHighestPosition ?? Number.POSITIVE_INFINITY;
  const roleLocked = (role: SpaceRole) => role.position >= roleCeiling();

  const rolesAvailableToAdd = createMemo(() => {
    if (!canEditMemberRoles()) return [];
    const ctx = roleEditCtx();
    if (!ctx) return [];
    return ctx.spaceRoles
      .filter((r) => r.name !== EVERYONE_ROLE_NAME && !r.bot_id && !pickedCustomRoleIds().has(r.id) && !roleLocked(r))
      .sort((a, b) => b.position - a.position);
  });

  async function persistCustomRoles(next: Set<string>) {
    const ctx = roleEditCtx();
    const s = subject();
    if (!ctx || !s || !canEditMemberRoles()) return;
    setRoleSaveErr('');
    setRoleSaveBusy(true);
    try {
      const chosen = [...next];
      await setMemberSpaceRoles(ctx.spaceId, s.userId, chosen);
      const everyoneId = ctx.spaceRoles.find((r) => r.name === EVERYONE_ROLE_NAME)?.id;
      const merged: string[] = [];
      if (everyoneId) merged.push(everyoneId);
      for (const id of chosen) {
        if (!merged.includes(id)) merged.push(id);
      }
      setUserProfilePopover('spaceRoleContext', 'subjectRoleIds', merged);
      setUserProfilePopover('subject', 'spaceRoles', rolesForMemberProfile(merged, ctx.spaceRoles));
      setUserProfilePopover('subject', 'nameColor', memberNameColorHex(merged, ctx.spaceRoles));
      ctx.onMemberRolesUpdated?.();
    } catch (e) {
      setRoleSaveErr(e instanceof Error ? e.message : t('profile.rolesUpdateFailed'));
      revertPickedFromContext();
    } finally {
      setRoleSaveBusy(false);
    }
  }

  async function removeMemberRole(roleId: string) {
    if (!canEditMemberRoles() || roleSaveBusy()) return;
    const next = new Set(pickedCustomRoleIds());
    next.delete(roleId);
    setPickedCustomRoleIds(next);
    await persistCustomRoles(next);
  }

  async function addMemberRole(roleId: string) {
    if (!canEditMemberRoles() || roleSaveBusy()) return;
    const next = new Set(pickedCustomRoleIds());
    next.add(roleId);
    setPickedCustomRoleIds(next);
    setAddRolesMenuOpen(false);
    await persistCustomRoles(next);
  }

  const showSpaceRolesRow = createMemo(() => !!roleEditCtx());
  const showRolesOrJoinSection = createMemo(
    () =>
      !!subject()?.joinedAtLabel ||
      showSpaceRolesRow() ||
      !!(subject()?.spaceRoles?.length && !roleEditCtx()),
  );

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

  function viewFullProfile() {
    const s = subject();
    if (!s) return;
    openUserProfileFullModal(
      {
        userId: s.userId,
        displayName: s.displayName,
        username: s.username,
        discriminator: s.discriminator,
        avatar: s.avatar,
        banner: s.banner,
        bio: s.bio,
        aboutMe: s.aboutMe,
        spaceRoles: s.spaceRoles,
        nameColor: s.nameColor,
        pronouns: s.pronouns,
        joinedAtLabel: s.joinedAtLabel,
        publicFlags: s.publicFlags,
        bot: s.bot,
      },
      {
        currentUserId: userProfilePopover.currentUserId,
        onMessageUser: userProfilePopover.onMessageUser,
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
      await sendMessage(room.id, text);
      setQuickDraft('');
      closeUserProfilePopover();
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : t('room.sendFailed'));
    } finally {
      setQuickSending(false);
    }
  }

  const RoleChip: Component<{
    role: SpaceRole;
    showRemove: boolean;
  }> = (p) => (
    <RolePill
      role={{ id: p.role.id, name: p.role.name, color: p.role.color ?? 0 }}
      onRemove={p.showRemove ? () => void removeMemberRole(p.role.id) : undefined}
      removeLabel={t('profile.removeRole', { name: p.role.name })}
      disabled={roleSaveBusy()}
    />
  );

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
              <div
                class="h-20 bg-gradient-to-br from-primary/60 via-primary/30 to-primary/10 bg-cover bg-center"
                style={{
                  ...(subject()?.banner ? { 'background-image': `url(${subject()!.banner})` } : {}),
                  ...(subject()?.banner
                    ? {}
                    : {
                        'background-image':
                          'radial-gradient(circle, rgba(255,255,255,0.14) 1px, transparent 1px)',
                        'background-size': '14px 14px',
                      }),
                }}
              />
              <div class="absolute end-2.5 top-2.5 flex items-center gap-1.5">
                <Show when={!isSelf() && userProfilePopover.onMessageUser}>
                  <BannerIconButton
                    icon="fa-solid fa-paper-plane"
                    title={t('friends.actions.message')}
                    onClick={() => {
                      const id = subject()?.userId;
                      const fn = userProfilePopover.onMessageUser;
                      if (id && fn) {
                        closeUserProfilePopover();
                        fn(id);
                      }
                    }}
                  />
                </Show>
                <Show when={!isSelf()}>
                  <BannerIconButton
                    icon="fa-solid fa-shield-halved"
                    title={t('safety.title')}
                    onClick={() => {
                      const s = subject();
                      if (!s) return;
                      openSafetyNumberModal({ userId: s.userId, displayName: s.displayName });
                      closeUserProfilePopover();
                    }}
                  />
                </Show>
                <BannerIconButton icon="fa-regular fa-id-card" title={t('userArea.copyUserId')} onClick={copyUserId} />
              </div>
              <div class="relative px-4 -mt-10">
                <div class="relative inline-block">
                  <MessageAvatar
                    name={subject()!.displayName}
                    avatar={subject()!.avatar}
                    class="size-20 border-4 border-popover bg-primary text-2xl font-semibold text-primary-foreground shadow-lg shadow-black/30"
                  />
                  <span class="absolute bottom-0.5 end-0.5">
                    <PresenceDot userId={subject()!.userId} class="size-5" borderClass="border-popover" />
                  </span>
                </div>
              </div>
            </div>

            <div class="px-4 pb-1 pt-2.5">
              <ProfileIdentity
                headingLevel="h3"
                compact
                displayName={subject()!.displayName}
                username={subject()!.username}
                discriminator={subject()!.discriminator}
                homeDomain={subject()!.homeDomain}
                bot={subject()!.bot}
                publicFlags={subject()!.publicFlags}
                pronouns={subject()!.pronouns}
                nameColor={subject()!.nameColor}
                onCopyTag={copyTag}
              />
            </div>

            <div class="mx-4 my-2.5 border-t border-border/60" />

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

            <Show when={showRolesOrJoinSection()}>
              <div class="space-y-2.5 px-4 pb-3">
                <Show when={showSpaceRolesRow()}>
                  <div>
                    <p class={`mb-1.5 ${appSectionLabel}`}>{t('profile.roles')}</p>
                    <div class="flex flex-wrap items-center gap-1.5">
                      <For each={visibleRoleChips()}>
                        {(role) => <RoleChip role={role} showRemove={canEditMemberRoles() && !roleLocked(role) && !role.bot_id} />}
                      </For>
                      <Show when={hiddenRoleChipCount() > 0}>
                        <span
                          class="inline-flex items-center rounded-full border border-border/80 bg-muted/20 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground"
                          title={t('profile.moreRoles', { count: hiddenRoleChipCount() })}
                        >
                          +{hiddenRoleChipCount()}
                        </span>
                      </Show>
                      <Show when={canEditMemberRoles()}>
                        <div class="relative inline-flex">
                          <button
                            id="profile-role-add-btn"
                            type="button"
                            disabled={roleSaveBusy()}
                            class="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border/90 text-muted-foreground transition hover:border-primary/60 hover:bg-muted/40 hover:text-foreground disabled:opacity-40"
                            title={t('profile.addRole')}
                            aria-label={t('profile.addRole')}
                            aria-expanded={addRolesMenuOpen()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddRolesMenuOpen((o) => !o);
                            }}
                          >
                            <i class="fa-solid fa-plus text-xs" />
                          </button>
                          <Show when={addRolesMenuOpen()}>
                            <div
                              id="profile-role-add-menu"
                              class={`absolute start-0 top-[calc(100%+6px)] z-10 max-h-48 min-w-[11rem] overflow-y-auto ${appMenuPanel}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Show
                                when={rolesAvailableToAdd().length > 0}
                                fallback={
                                  <p class="px-3 py-2 text-xs text-muted-foreground">{t('profile.noRolesToAdd')}</p>
                                }
                              >
                                <For each={rolesAvailableToAdd()}>
                                  {(role) => (
                                    <button
                                      type="button"
                                      class={appMenuItemDefault}
                                      onClick={() => void addMemberRole(role.id)}
                                    >
                                      <span
                                        class="size-2 shrink-0 rounded-full ring-1 ring-border/40"
                                        style={{ 'background-color': spaceRoleColorHex(role.color) }}
                                      />
                                      <span class="truncate">{role.name}</span>
                                    </button>
                                  )}
                                </For>
                              </Show>
                            </div>
                          </Show>
                        </div>
                      </Show>
                    </div>
                    <Show when={!displayedSortedRoles().length}>
                      <p class="text-xs text-muted-foreground">
                        {canEditMemberRoles() ? t('profile.noRolesYetEditable') : t('profile.noRolesAssigned')}
                      </p>
                    </Show>
                    {roleSaveErr() && <p class="mt-1 text-xs text-destructive">{roleSaveErr()}</p>}
                  </div>
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

            <div class="px-4 pb-3">
              <button
                type="button"
                onClick={viewFullProfile}
                class="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <i class="fa-regular fa-user text-[11px]" />
                {t('profile.viewFull')}
              </button>
            </div>
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
