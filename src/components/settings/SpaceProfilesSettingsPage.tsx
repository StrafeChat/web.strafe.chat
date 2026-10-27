import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, For, Match, on, onCleanup, Show, Switch, untrack } from 'solid-js';
import { useLocation } from '@solidjs/router';
import {
  getSpaceMember,
  patchSpaceMember,
  uploadSpaceMemberAvatar,
  uploadSpaceMemberBanner,
  type SpaceMember,
  type SpaceProfilePatch,
} from '../../api/spaces';
import { auth } from '../../stores/auth';
import { ensureSpaceRoles, spaces } from '../../stores/spaces';
import { spaceMembers, upsertSpaceMember } from '../../stores/spaceMembers';
import { takePendingSpaceProfileSpaceId } from '../../stores/userSettingsModal';
import { confirmDialog } from '../../stores/confirmDialog';
import { hasResettableSpaceProfile, resolveProfile, spaceMemberOf, spaceProfileResetPatch } from '../../lib/spaceProfile';
import { memberCanChangeNickname } from '../../lib/spacePermissions';
import { memberNameColorHex } from '../../lib/userProfilePopoverHelpers';
import { markdownAndHtmlToSanitizedBioHtml } from '../../lib/profileRichText';
import { translateCaughtApiError } from '../../lib/formatApiError';
import { inputMaxLength, spaceProfileFieldError } from '../../lib/spaceProfileLimits';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { MessageBody } from '../messageList/MessageBody';
import { ProfileIdentity } from '../ProfileIdentity';
import { ProfileMediaEditor } from './ProfileMediaEditor';
import { settingsGroupFrame, settingsRowIcon, settingsSectionTitle } from './settingsChrome';
import { appSectionLabel } from '../../theme/appChrome';
import { t } from '../../i18n';

/** The text half of a space profile, as the form edits it ('' = not set). The images are not
 * drafts: they upload the moment they are picked, as on the main profile. */
interface TextFields {
  nick: string;
  pronouns: string;
  aboutMe: string;
  bio: string;
}

const TEXT_KEYS = ['nick', 'pronouns', 'aboutMe', 'bio'] as const;

/** Each field's PATCH key. */
const WIRE_KEY = { nick: 'nick', pronouns: 'pronouns', aboutMe: 'about_me', bio: 'bio' } as const;

const NO_TEXT: TextFields = { nick: '', pronouns: '', aboutMe: '', bio: '' };

function textOf(m: SpaceMember | undefined): TextFields {
  return {
    nick: m?.nick ?? '',
    pronouns: m?.space_pronouns ?? '',
    aboutMe: m?.space_about_me ?? '',
    bio: m?.space_bio ?? '',
  };
}

/** Compared trimmed, as the server stores them: trailing spaces are not an edit. */
function sameText(a: TextFields, b: TextFields): boolean {
  return TEXT_KEYS.every((k) => a[k].trim() === b[k].trim());
}

function errorText(err: unknown, fallbackKey: string): string {
  return translateCaughtApiError(err, t).join(' ') || t(fallbackKey);
}

/**
 * Your row from this page, into the member store only when the space's list is already
 * there. A list this page started would hold just you, and the members store is what an
 * E2EE space room shares its Megolm key from: a send whose member fetch then failed would
 * fall back to it and share the key with nobody but you. The page keeps its own copy
 * (`loaded`) for a space whose list has not been fetched.
 */
function storeOwnRow(sid: string, m: SpaceMember) {
  if (spaceMembers.bySpaceId[sid]?.length) upsertSpaceMember(sid, m);
}

export interface SpaceProfilesSettingsPageProps {
  /** Whether the text fields hold unsaved edits, for the settings modal's close guard. */
  onDirtyChange?: (dirty: boolean) => void;
  /** "Edit main profile": switch the modal to My Account. */
  onEditMainProfile?: () => void;
}

const fieldCard = 'flex gap-4 rounded-xl border border-border bg-muted/20 px-4 py-4 transition-colors hover:bg-muted/25';

/**
 * Settings > Space Profiles: your nickname, avatar, banner, pronouns, About Me and bio in one
 * space at a time. Each overrides the main profile in that space only, and anything left
 * empty shows the main one (lib/spaceProfile's resolveProfile is the rule, here and on every
 * surface that renders a member).
 *
 * Text fields are drafts saved together from the unsaved bar, sending only what changed, so a
 * save never writes back a field another device edited meanwhile. Images upload on pick.
 */
export const SpaceProfilesSettingsPage: Component<SpaceProfilesSettingsPageProps> = (props) => {
  const location = useLocation();
  // The space "Edit Space Profile" was opened from, consumed once: later visits to the
  // section start on the active space instead.
  const pendingSpaceId = takePendingSpaceProfileSpaceId();
  const myId = () => auth.user?.id;

  const [spaceId, setSpaceId] = createSignal<string | null>(null);
  // What the picker shows, kept apart from spaceId so a switch the person backs out of (with
  // unsaved edits) can put the picker back: the select has already changed by then.
  const [pickerValue, setPickerValue] = createSignal('');

  const [loadState, setLoadState] = createSignal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  /** The row GET /members/@me returned, until the member store has one to prefer. */
  const [loaded, setLoaded] = createSignal<SpaceMember | undefined>();
  /** What the drafts started from - the fields a save compares against. */
  const [baseline, setBaseline] = createSignal<TextFields>(NO_TEXT);
  const [drafts, setDrafts] = createSignal<TextFields>(NO_TEXT);

  const [saving, setSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal('');
  const [avatarUploading, setAvatarUploading] = createSignal(false);
  const [bannerUploading, setBannerUploading] = createSignal(false);
  const [removing, setRemoving] = createSignal<'avatar' | 'banner' | null>(null);
  const [mediaError, setMediaError] = createSignal('');
  const [resetting, setResetting] = createSignal(false);
  const [resetError, setResetError] = createSignal('');

  const busy = () => saving() || resetting() || avatarUploading() || bannerUploading() || removing() !== null;

  const space = createMemo(() => spaces.spaces.find((s) => s.id === spaceId()));
  const roles = () => space()?.roles;
  /** Your row in the picked space: the store's copy (which gateway events keep current), else
   * the one just fetched. */
  const member = createMemo((): SpaceMember | undefined => {
    const sid = spaceId();
    const me = myId();
    if (!sid || !me) return undefined;
    const fetched = loaded();
    return spaceMemberOf(sid, me) ?? (fetched?.id === me ? fetched : undefined);
  });

  const canChangeNick = createMemo(() => memberCanChangeNickname(space(), roles(), member(), myId()));
  // Without Change Nickname the field is hidden, as Discord hides it - but only once the
  // space's roles are known to say so: hiding it on roles that have not arrived would be wrong
  // as often as not, and the server decides either way.
  const nickLocked = () => roles() !== undefined && !canChangeNick();

  /** Pick the space to start on: the one asked for, else the one on screen, else the first. */
  function preferredSpaceId(): string | null {
    const list = spaces.spaces;
    const listed = (id: string | null | undefined): id is string => !!id && list.some((s) => s.id === id);
    if (listed(pendingSpaceId)) return pendingSpaceId;
    const active = location.pathname.match(/^\/spaces\/([^/]+)/)?.[1];
    if (listed(active)) return active;
    return list[0]?.id ?? null;
  }

  // Choose a space once the list is there, and choose again if the picked one goes away
  // (left, kicked, deleted) - its drafts went with it.
  createEffect(() => {
    // Read the whole list up front so this re-runs when it changes even while nothing is
    // picked yet (no spaces at mount, then a first one arrives).
    const ids = spaces.spaces.map((s) => s.id);
    const current = spaceId();
    if (current && ids.includes(current)) return;
    const next = untrack(preferredSpaceId);
    if (next === current) return;
    setSpaceId(next);
    setPickerValue(next ?? '');
  });

  let loadSeq = 0;
  async function load(sid: string | null) {
    const seq = ++loadSeq;
    setLoaded(undefined);
    setBaseline(NO_TEXT);
    setDrafts(NO_TEXT);
    setSaveError('');
    setMediaError('');
    setResetError('');
    if (!sid) {
      setLoadState('idle');
      return;
    }
    setLoadState('loading');
    // Nickname permission is computed from the space's roles; READY normally carried them.
    void ensureSpaceRoles(sid);
    try {
      const m = await getSpaceMember(sid, '@me');
      if (seq !== loadSeq) return;
      // The API helpers never touch stores. Where the space's list is loaded, the row there is
      // what lets this page follow your edits from another device (SPACE_MEMBER_UPDATE
      // patches the store's rows).
      storeOwnRow(sid, m);
      setLoaded(m);
      seed(textOf(m));
      setLoadState('ready');
    } catch {
      if (seq !== loadSeq) return;
      setLoadState('error');
    }
  }

  createEffect(on(spaceId, (sid) => void load(sid)));

  function seed(v: TextFields) {
    setBaseline(v);
    setDrafts(v);
  }

  function setDraft(key: keyof TextFields, value: string) {
    setDrafts((d) => ({ ...d, [key]: value }));
  }

  // A hidden nickname never counts as an edit: it cannot be seen or saved (sending it would get
  // the whole save refused), so it must not hold the page dirty or block Save.
  const changedKeys = createMemo(() =>
    TEXT_KEYS.filter((k) => !(k === 'nick' && nickLocked()) && drafts()[k].trim() !== baseline()[k].trim())
  );
  const dirty = createMemo(() => loadState() === 'ready' && changedKeys().length > 0);
  /** Why the server would refuse an edited field, translated; only edits are judged. */
  const fieldError = (k: keyof TextFields): string | undefined => {
    if (!changedKeys().includes(k)) return undefined;
    const key = spaceProfileFieldError(k, drafts()[k]);
    return key ? t(key) : undefined;
  };
  const invalid = createMemo(() => changedKeys().some((k) => spaceProfileFieldError(k, drafts()[k])));

  createEffect(() => props.onDirtyChange?.(dirty()));
  onCleanup(() => props.onDirtyChange?.(false));

  // While nothing is being edited, show what the store says: a change made on another device
  // (or by a moderator, for the nickname) arrives there through SPACE_MEMBER_UPDATE.
  createEffect(() => {
    const m = member();
    if (loadState() !== 'ready' || !m || dirty() || saving() || resetting()) return;
    const next = textOf(m);
    if (!sameText(next, untrack(baseline))) seed(next);
  });

  /** A write came back: it is the member's state now. */
  function applyResult(sid: string, m: SpaceMember, opts?: { reseed?: boolean }) {
    storeOwnRow(sid, m);
    if (sid !== spaceId()) return;
    setLoaded(m);
    if (opts?.reseed) seed(textOf(m));
  }

  async function save() {
    const sid = spaceId();
    if (!sid || busy() || invalid()) return;
    const patch: SpaceProfilePatch = {};
    const d = drafts();
    for (const k of changedKeys()) {
      // Empty clears it, so the main profile shows through again.
      patch[WIRE_KEY[k]] = d[k].trim() || null;
    }
    if (!Object.keys(patch).length) return;
    setSaving(true);
    setSaveError('');
    try {
      applyResult(sid, await patchSpaceMember(sid, '@me', patch), { reseed: true });
    } catch (err) {
      setSaveError(errorText(err, 'settings.spaceProfiles.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    seed(textOf(member()));
    setSaveError('');
  }

  async function uploadImage(kind: 'avatar' | 'banner', file: File) {
    const sid = spaceId();
    if (!sid) return;
    const setUploading = kind === 'avatar' ? setAvatarUploading : setBannerUploading;
    setMediaError('');
    setUploading(true);
    try {
      const m = await (kind === 'avatar' ? uploadSpaceMemberAvatar(sid, file) : uploadSpaceMemberBanner(sid, file));
      // No reseed: images are not drafts, and text edits in progress must survive an upload.
      applyResult(sid, m);
    } catch (err) {
      setMediaError(errorText(err, 'settings.profile.uploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(kind: 'avatar' | 'banner') {
    const sid = spaceId();
    if (!sid || busy()) return;
    setRemoving(kind);
    setMediaError('');
    try {
      const m = await patchSpaceMember(sid, '@me', kind === 'avatar' ? { avatar: null } : { banner: null });
      applyResult(sid, m);
    } catch (err) {
      setMediaError(errorText(err, 'settings.spaceProfiles.saveFailed'));
    } finally {
      setRemoving(null);
    }
  }

  // Without Change Nickname the reset leaves the nickname out (sending it would get the whole
  // reset refused), so a nickname a moderator set neither counts as something to reset nor
  // is promised away in the confirmation.
  const resetKeepsNick = () => !canChangeNick();
  const canReset = () => hasResettableSpaceProfile(member(), { ignoreNick: resetKeepsNick() });

  async function resetProfile() {
    const sid = spaceId();
    const sp = space();
    if (!sid || !sp || busy() || !canReset()) return;
    const keepNick = resetKeepsNick();
    const ok = await confirmDialog({
      title: t('settings.spaceProfiles.resetTitle'),
      body: t(keepNick ? 'settings.spaceProfiles.resetBodyKeepsNick' : 'settings.spaceProfiles.resetBody', { space: sp.name }),
      confirmLabel: t('settings.spaceProfiles.reset'),
      tone: 'danger',
      icon: 'fa-solid fa-eraser',
    });
    if (!ok || sid !== spaceId()) return;
    setResetting(true);
    setResetError('');
    try {
      // Reseeded: the confirmation said everything goes back, unsaved edits included.
      applyResult(sid, await patchSpaceMember(sid, '@me', spaceProfileResetPatch({ includeNick: !keepNick })), {
        reseed: true,
      });
    } catch (err) {
      setResetError(errorText(err, 'settings.spaceProfiles.saveFailed'));
    } finally {
      setResetting(false);
    }
  }

  async function pickSpace(id: string) {
    const prev = spaceId();
    if (id === prev) return;
    setPickerValue(id);
    if (dirty()) {
      const discardEdits = await confirmDialog({
        title: t('settings.unsaved.title'),
        body: t('settings.spaceProfiles.switchUnsavedBody'),
        confirmLabel: t('common.discard'),
        tone: 'danger',
      });
      if (!discardEdits) {
        setPickerValue(prev ?? '');
        return;
      }
    }
    setSpaceId(id);
  }

  const spaceName = () => space()?.name ?? '';
  const globalName = () => auth.user?.display_name || auth.user?.username || '';

  /** The card as others in the space will see it, drawn from the drafts as they are typed. */
  const preview = createMemo(() => {
    const d = drafts();
    const m = member();
    return resolveProfile(auth.user, {
      nick: d.nick,
      space_avatar: m?.space_avatar,
      space_banner: m?.space_banner,
      space_about_me: d.aboutMe,
      space_bio: d.bio,
      space_pronouns: d.pronouns,
    });
  });
  const effective = createMemo(() => resolveProfile(auth.user, member()));
  const bioPreviewHtml = createMemo(() => markdownAndHtmlToSanitizedBioHtml(drafts().bio));

  return (
    <div class="flex min-w-0 flex-1 flex-col">
      <Show
        when={spaces.spaces.length > 0}
        fallback={
          <div class={`${settingsGroupFrame} max-w-2xl text-sm text-muted-foreground`}>
            {t('settings.spaceProfiles.noSpaces')}
          </div>
        }
      >
        <div class="max-w-2xl space-y-3">
          <Select
            label={t('settings.spaceProfiles.space')}
            value={pickerValue()}
            onValueChange={(id) => void pickSpace(id)}
            disabled={busy()}
          >
            <For each={spaces.spaces}>{(sp) => <option value={sp.id}>{sp.name}</option>}</For>
          </Select>
          <div class={`${settingsGroupFrame} space-y-2 text-sm leading-relaxed text-muted-foreground`}>
            <p>{t('settings.spaceProfiles.intro', { space: spaceName() })}</p>
            <p>{t('settings.spaceProfiles.visibility', { space: spaceName() })}</p>
            <Show when={space()?.federation}>
              {(fed) => <p>{t('settings.spaceProfiles.hostedOn', { domain: fed().origin_domain })}</p>}
            </Show>
            <Show when={props.onEditMainProfile}>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => props.onEditMainProfile?.()}
              >
                <i class="fa-solid fa-user text-xs" aria-hidden="true" />
                {t('settings.spaceProfiles.editMain')}
              </button>
            </Show>
          </div>
        </div>

        <Switch>
          <Match when={loadState() === 'loading'}>
            <p class="mt-8 text-sm text-muted-foreground">{t('common.loading')}</p>
          </Match>
          <Match when={loadState() === 'error'}>
            <div class="mt-8 flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3">
              <p class="text-sm text-destructive">{t('settings.spaceProfiles.loadFailed')}</p>
              <Button size="sm" variant="outline" onClick={() => void load(spaceId())}>
                {t('common.retry')}
              </Button>
            </div>
          </Match>
          <Match when={loadState() === 'ready'}>
            <div class="mt-8 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_18.5rem]">
              {/* First in the DOM so a phone shows the result above the form; beside it from lg. */}
              <aside class="min-w-0 space-y-2 lg:sticky lg:top-0 lg:order-last lg:self-start">
                <h3 class={settingsSectionTitle}>{t('settings.spaceProfiles.preview')}</h3>
                <div class="overflow-hidden rounded-2xl border border-border bg-popover/80 shadow-lg shadow-black/20">
                  <div
                    class="h-20 bg-gradient-to-br from-primary/60 via-primary/30 to-primary/10 bg-cover bg-center"
                    style={
                      preview().banner
                        ? { 'background-image': `url(${preview().banner})` }
                        : {
                            'background-image': 'radial-gradient(circle, rgba(255,255,255,0.14) 1px, transparent 1px)',
                            'background-size': '14px 14px',
                          }
                    }
                  />
                  <div class="relative -mt-10 px-4">
                    <MessageAvatar
                      name={preview().name}
                      avatar={preview().avatar}
                      class="size-20 border-4 border-popover bg-primary text-2xl font-semibold text-primary-foreground shadow-lg shadow-black/30"
                    />
                  </div>
                  <div class="px-4 pb-4 pt-2.5">
                    <ProfileIdentity
                      headingLevel="h3"
                      compact
                      displayName={preview().name}
                      secondaryName={preview().nick && preview().globalName !== preview().name ? preview().globalName : undefined}
                      username={auth.user?.username ?? ''}
                      bot={auth.user?.bot}
                      publicFlags={auth.user?.public_flags}
                      pronouns={preview().pronouns}
                      nameColor={memberNameColorHex(member()?.roles, roles())}
                    />
                    <Show when={preview().aboutMe?.trim()}>
                      {(about) => (
                        <div class="mt-3 border-t border-border/60 pt-3">
                          <p class={`mb-1.5 ${appSectionLabel}`}>{t('settings.profile.aboutMe')}</p>
                          <MessageBody text={about()} class="break-words text-sm leading-relaxed text-foreground/95" />
                        </div>
                      )}
                    </Show>
                  </div>
                </div>
                <p class="px-0.5 text-xs text-muted-foreground">{t('settings.spaceProfiles.previewHint', { space: spaceName() })}</p>
              </aside>

              <div class="min-w-0 space-y-8">
                <section class="space-y-3">
                  <h3 class={settingsSectionTitle}>{t('settings.profile.mediaTitle')}</h3>
                  <ProfileMediaEditor
                    name={effective().name}
                    userId={myId() ?? ''}
                    avatar={effective().avatar}
                    banner={effective().banner}
                    avatarUploading={avatarUploading()}
                    bannerUploading={bannerUploading()}
                    onAvatarFile={(file) => void uploadImage('avatar', file)}
                    onBannerFile={(file) => void uploadImage('banner', file)}
                    onInvalidFile={(_kind, message) => setMediaError(message)}
                    error={mediaError() || undefined}
                    avatarLabel={t('settings.spaceProfiles.avatar')}
                    bannerLabel={t('settings.spaceProfiles.banner')}
                    actions={
                      <Show when={member()?.space_avatar || member()?.space_banner}>
                        <div class="flex flex-wrap gap-2 pt-1 sm:justify-end">
                          <Show when={member()?.space_avatar}>
                            <Button
                              size="sm"
                              variant="outline"
                              loading={removing() === 'avatar'}
                              disabled={busy()}
                              onClick={() => void removeImage('avatar')}
                            >
                              {t('settings.spaceProfiles.removeAvatar')}
                            </Button>
                          </Show>
                          <Show when={member()?.space_banner}>
                            <Button
                              size="sm"
                              variant="outline"
                              loading={removing() === 'banner'}
                              disabled={busy()}
                              onClick={() => void removeImage('banner')}
                            >
                              {t('settings.spaceProfiles.removeBanner')}
                            </Button>
                          </Show>
                        </div>
                      </Show>
                    }
                  />
                </section>

                <section class="space-y-3">
                  <h3 class={settingsSectionTitle}>{t('settings.profile.detailsTitle')}</h3>
                  <div class="space-y-2">
                    <Show when={!nickLocked()}>
                      <div class={fieldCard}>
                        <div class={settingsRowIcon}>
                          <i class="fa-solid fa-signature text-sm" />
                        </div>
                        <div class="min-w-0 flex-1 space-y-2">
                          <label for="space-profile-nick" class="text-[15px] font-semibold text-foreground">
                            {t('settings.spaceProfiles.nickname')}
                          </label>
                          <Input
                            id="space-profile-nick"
                            value={drafts().nick}
                            maxLength={inputMaxLength('nick')}
                            error={fieldError('nick')}
                            placeholder={globalName()}
                            autocomplete="off"
                            disabled={saving() || resetting()}
                            onInput={(e) => setDraft('nick', e.currentTarget.value)}
                            class="rounded-lg border-border bg-background/60"
                          />
                          <p class="text-xs text-muted-foreground">{t('settings.spaceProfiles.nicknameHint')}</p>
                        </div>
                      </div>
                    </Show>
                    <div class={fieldCard}>
                      <div class={settingsRowIcon}>
                        <i class="fa-solid fa-venus-mars text-sm" />
                      </div>
                      <div class="min-w-0 flex-1 space-y-2">
                        <label for="space-profile-pronouns" class="text-[15px] font-semibold text-foreground">
                          {t('settings.profile.pronouns')}
                        </label>
                        <Input
                          id="space-profile-pronouns"
                          value={drafts().pronouns}
                          maxLength={inputMaxLength('pronouns')}
                          error={fieldError('pronouns')}
                          placeholder={t('settings.profile.pronounsPlaceholder')}
                          disabled={saving() || resetting()}
                          onInput={(e) => setDraft('pronouns', e.currentTarget.value)}
                          class="rounded-lg border-border bg-background/60"
                        />
                        <p class="text-xs text-muted-foreground">{t('settings.spaceProfiles.usesMain')}</p>
                      </div>
                    </div>
                    <div class={fieldCard}>
                      <div class={settingsRowIcon}>
                        <i class="fa-regular fa-note-sticky text-sm" />
                      </div>
                      <div class="min-w-0 flex-1 space-y-2">
                        <label for="space-profile-about" class="text-[15px] font-semibold text-foreground">
                          {t('settings.profile.aboutMe')}
                        </label>
                        <Textarea
                          id="space-profile-about"
                          value={drafts().aboutMe}
                          maxLength={inputMaxLength('aboutMe')}
                          error={fieldError('aboutMe')}
                          rows={2}
                          placeholder={t('settings.profile.aboutMePlaceholder')}
                          disabled={saving() || resetting()}
                          onInput={(e) => setDraft('aboutMe', e.currentTarget.value)}
                          class="min-h-[52px] border-border bg-background/60"
                        />
                        <p class="text-xs text-muted-foreground">{t('settings.spaceProfiles.usesMain')}</p>
                      </div>
                    </div>
                    <div class={fieldCard}>
                      <div class={settingsRowIcon}>
                        <i class="fa-solid fa-align-left text-sm" />
                      </div>
                      <div class="min-w-0 flex-1 space-y-2">
                        <label for="space-profile-bio" class="text-[15px] font-semibold text-foreground">
                          {t('settings.profile.bio')}
                        </label>
                        <Textarea
                          id="space-profile-bio"
                          value={drafts().bio}
                          maxLength={inputMaxLength('bio')}
                          error={fieldError('bio')}
                          rows={5}
                          placeholder={t('settings.profile.bioPlaceholder')}
                          disabled={saving() || resetting()}
                          onInput={(e) => setDraft('bio', e.currentTarget.value)}
                          class="min-h-[120px] border-border bg-background/60"
                        />
                        <p class="text-xs text-muted-foreground">{t('settings.spaceProfiles.usesMain')}</p>
                        <Show when={bioPreviewHtml()}>
                          <div class="rounded-lg border border-border bg-muted/25 px-3 py-3">
                            <p class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t('common.preview')}
                            </p>
                            <div
                              class="bio-preview text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted/50 [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                              // eslint-disable-next-line solid/no-innerhtml -- DOMPurify-sanitised in lib/profileRichText.ts
                              innerHTML={bioPreviewHtml()}
                            />
                          </div>
                        </Show>
                      </div>
                    </div>
                  </div>
                </section>

                <section class="space-y-3">
                  <div class="flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      class="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      loading={resetting()}
                      disabled={busy() || !canReset()}
                      onClick={() => void resetProfile()}
                    >
                      <Show when={!resetting()}>
                        <i class="fa-solid fa-eraser text-xs" aria-hidden="true" />
                      </Show>
                      {t('settings.spaceProfiles.reset')}
                    </Button>
                  </div>
                  <Show when={resetError()}>
                    <p class="text-xs text-destructive">{resetError()}</p>
                  </Show>
                </section>

                <Show when={dirty()}>
                  <div class="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-popover/95 px-4 py-3 shadow-lg backdrop-blur">
                    <div class="min-w-0">
                      <p class="text-sm text-muted-foreground">{t('settings.unsaved.title')}</p>
                      <Show when={saveError()}>
                        <p class="text-xs text-destructive" role="alert">
                          {saveError()}
                        </p>
                      </Show>
                    </div>
                    <div class="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={discard} disabled={saving()}>
                        {t('common.discardChanges')}
                      </Button>
                      <Button type="button" size="sm" onClick={() => void save()} loading={saving()} disabled={busy() || invalid()}>
                        {t('common.saveChanges')}
                      </Button>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </Match>
        </Switch>
      </Show>
    </div>
  );
};
