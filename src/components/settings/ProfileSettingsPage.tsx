import type { Component } from 'solid-js';
import { createSignal, onMount, createEffect, createMemo, Show } from 'solid-js';
import { auth, setAuthUser, logout } from '../../stores/auth';
import { getMe, patchMe, toAuthUser, uploadAvatar, uploadBanner } from '../../api/users';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Toggle } from '../ui/Toggle';
import { PresenceDot } from '../PresenceDot';
import { formatDiscriminator } from './types.js';
import { settingsSectionTitle } from './settingsChrome';
import { useNavigate } from '@solidjs/router';
import { closeUserSettings } from '../../stores/userSettingsModal';
import { markdownAndHtmlToSanitizedBioHtml } from '../../lib/profileRichText';
import { formatBirthday } from '../../lib/utils/birthday';
import { t } from '../../i18n';

function getInitialName(): string {
  const u = auth.user;
  return u?.display_name || u?.username || '';
}

export interface ProfileSettingsPageProps {
  onDirtyChange?: (dirty: boolean) => void;
  /** Register so parent can trigger save from header button */
  registerSaveHandler?: (save: () => void) => void;
  onSavingChange?: (saving: boolean) => void;
}

export const ProfileSettingsPage: Component<ProfileSettingsPageProps> = (props) => {
  const navigate = useNavigate();
  const [displayNameDraft, setDisplayNameDraft] = createSignal(getInitialName());
  const [bioDraft, setBioDraft] = createSignal('');
  const [aboutMeDraft, setAboutMeDraft] = createSignal('');
  const [pronounsDraft, setPronounsDraft] = createSignal('');
  const [savingProfile, setSavingProfile] = createSignal(false);
  const [profileError, setProfileError] = createSignal('');
  const [avatarUploading, setAvatarUploading] = createSignal(false);
  const [avatarError, setAvatarError] = createSignal('');
  let avatarFileInput: HTMLInputElement | undefined;
  const [bannerUploading, setBannerUploading] = createSignal(false);
  const [bannerError, setBannerError] = createSignal('');
  let bannerFileInput: HTMLInputElement | undefined;
  // The birthday opt-in is its own switch that saves the moment it flips, so it is kept out
  // of the draft above (a discarded profile edit must not silently undo it, and vice versa).
  const [birthday, setBirthday] = createSignal<string | undefined>(undefined);
  const [birthdayOptIn, setBirthdayOptIn] = createSignal(false);
  const [birthdayBusy, setBirthdayBusy] = createSignal(false);
  const [birthdayError, setBirthdayError] = createSignal('');

  const profileImageMaxBytes = 8 * 1024 * 1024;

  function markDirty() {
    props.onDirtyChange?.(true);
  }
  function markClean() {
    props.onDirtyChange?.(false);
  }

  const user = () => auth.user;
  const discriminatorStr = () => formatDiscriminator(user()?.discriminator ?? 0);
  const displayName = () => user()?.display_name || user()?.username || '';

  const bioPreviewHtml = createMemo(() => markdownAndHtmlToSanitizedBioHtml(bioDraft()));
  const birthdayLabel = createMemo(() => formatBirthday(birthday()));

  createEffect(() => {
    props.registerSaveHandler?.(() => saveProfile());
  });

  onMount(() => {
    getMe()
      .then((me) => {
        setDisplayNameDraft(me.display_name || me.username || '');
        setBioDraft(me.bio ?? '');
        setAboutMeDraft(me.about_me ?? '');
        setPronounsDraft(me.pronouns ?? '');
        setBirthday(me.birthday);
        setBirthdayOptIn(me.birthday_opt_in === true);
        const u = auth.user;
        if (u) setAuthUser({ ...u, ...toAuthUser(me) });
        markClean();
      })
      .catch(() => {
        const u = auth.user;
        setDisplayNameDraft(u?.display_name || u?.username || '');
        setPronounsDraft(u?.pronouns ?? '');
        setBirthday(u?.birthday);
        setBirthdayOptIn(u?.birthday_opt_in === true);
        markClean();
      });
  });

  async function saveProfile() {
    const name = displayNameDraft().trim();
    const bio = bioDraft().trim();
    const about = aboutMeDraft().trim();
    const u = user();
    if (!u) return;
    setProfileError('');
    setSavingProfile(true);
    props.onSavingChange?.(true);
    try {
      const me = await patchMe({
        display_name: name || undefined,
        bio: bio || undefined,
        about_me: about || undefined,
        // Sent even when empty: an empty string is how the server is told to clear it, while
        // omitting the key would leave whatever was there before.
        pronouns: pronounsDraft().trim(),
      });
      setAuthUser({ ...u, ...toAuthUser(me) });
      markClean();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t('settings.profile.saveFailed'));
    } finally {
      setSavingProfile(false);
      props.onSavingChange?.(false);
    }
  }

  async function toggleBirthdayOptIn(next: boolean) {
    if (birthdayBusy()) return;
    setBirthdayBusy(true);
    setBirthdayError('');
    try {
      const me = await patchMe({ birthday_opt_in: next });
      setBirthdayOptIn(me.birthday_opt_in === true);
      const u = auth.user;
      if (u) setAuthUser({ ...u, ...toAuthUser(me) });
    } catch (err) {
      setBirthdayError(err instanceof Error ? err.message : t('settings.profile.birthdaySaveFailed'));
    } finally {
      setBirthdayBusy(false);
    }
  }

  function copyUserId() {
    if (user()?.id) navigator.clipboard.writeText(user()!.id);
  }

  async function onAvatarSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError(t('settings.profile.imageTypeError'));
      return;
    }
    if (file.size > profileImageMaxBytes) {
      setAvatarError(t('settings.profile.imageSizeError'));
      return;
    }
    setAvatarError('');
    setAvatarUploading(true);
    try {
      const me = await uploadAvatar(file);
      const u = auth.user;
      if (u) setAuthUser({ ...u, ...toAuthUser(me) });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : t('settings.profile.uploadFailed'));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onBannerSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setBannerError(t('settings.profile.imageTypeError'));
      return;
    }
    if (file.size > profileImageMaxBytes) {
      setBannerError(t('settings.profile.imageSizeError'));
      return;
    }
    setBannerError('');
    setBannerUploading(true);
    try {
      const me = await uploadBanner(file);
      const u = auth.user;
      if (u) setAuthUser({ ...u, ...toAuthUser(me) });
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : t('settings.profile.uploadFailed'));
    } finally {
      setBannerUploading(false);
    }
  }

  function handleLogout() {
    logout();
    closeUserSettings();
    navigate('/login');
  }

  const fieldIcon = 'flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground';
  const fieldCard =
    'flex gap-4 rounded-xl border border-border bg-muted/20 px-4 py-4 transition-colors hover:bg-muted/25';

  return (
    <>
      <div class="flex min-w-0 flex-1 flex-col gap-10">
        <div class="min-w-0 flex-1 space-y-8 max-w-2xl">
          <section class="space-y-3">
            <h3 class={settingsSectionTitle}>
              {t('settings.profile.mediaTitle')}
            </h3>
            <div class="overflow-hidden rounded-xl border border-border bg-muted/15 shadow-sm">
              <input
                ref={(el) => {
                  avatarFileInput = el;
                }}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                class="hidden"
                onChange={onAvatarSelected}
              />
              <input
                ref={(el) => {
                  bannerFileInput = el;
                }}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                class="hidden"
                onChange={onBannerSelected}
              />
              <button
                type="button"
                disabled={bannerUploading()}
                title={t('settings.profile.changeBanner')}
                aria-label={t('settings.profile.changeBannerAria')}
                class="group/banner relative flex h-28 w-full cursor-pointer border-0 bg-gradient-to-br from-primary/30 to-primary/10 bg-cover bg-center p-0 text-start outline-none ring-inset ring-ring transition focus-visible:ring-2 disabled:cursor-wait disabled:opacity-70"
                style={
                  auth.user?.banner
                    ? { 'background-image': `url(${auth.user.banner})` }
                    : undefined
                }
                onClick={() => {
                  if (!bannerUploading()) bannerFileInput?.click();
                }}
              >
                <span class="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover/banner:bg-black/50 group-focus-visible/banner:bg-black/45" />
                <span class="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm font-medium text-white opacity-0 transition-opacity group-hover/banner:opacity-100 group-focus-visible/banner:opacity-100">
                  {t('settings.profile.changeBanner')}
                </span>
                {bannerUploading() && (
                  <span class="absolute inset-0 z-[1] flex items-center justify-center bg-background/60 text-sm font-medium text-foreground backdrop-blur-[2px]">
                    {t('common.uploading')}
                  </span>
                )}
              </button>
              <div class="flex flex-col gap-3 px-4 pb-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
                <button
                  type="button"
                  disabled={avatarUploading()}
                  title={t('settings.profile.changeAvatar')}
                  aria-label={t('settings.profile.changeAvatarAria')}
                  class="group/avatar relative -mt-12 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none ring-offset-2 ring-offset-card transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70 sm:-mt-14"
                  onClick={() => {
                    if (!avatarUploading()) avatarFileInput?.click();
                  }}
                >
                  <span class="relative block rounded-full">
                    <MessageAvatar
                      name={displayNameDraft() || displayName()}
                      avatar={auth.user?.avatar}
                      class="pointer-events-none size-20 border-[3px] border-card bg-primary text-xl text-primary-foreground shadow-md sm:size-[5.25rem] sm:text-2xl"
                    />
                    <span class="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition-colors group-hover/avatar:bg-black/55 group-focus-visible/avatar:bg-black/50" />
                    <span class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full px-2 text-center text-[10px] font-semibold leading-tight text-white opacity-0 transition-opacity group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100 sm:text-xs">
                      {t('settings.profile.changeAvatar')}
                    </span>
                  </span>
                  <span class="pointer-events-none absolute bottom-1 right-1 z-[1]">
                    <PresenceDot userId={user()?.id ?? ''} class="size-4" />
                  </span>
                  {avatarUploading() && (
                    <span class="absolute inset-0 z-[2] flex items-center justify-center rounded-full bg-background/60 text-[11px] font-medium text-foreground backdrop-blur-[2px]">
                      …
                    </span>
                  )}
                </button>
                <div class="flex min-w-0 flex-1 flex-col gap-1 sm:items-end sm:pb-1">
                  <p class="text-[11px] text-muted-foreground sm:text-end">{t('settings.profile.mediaHint')}</p>
                  {(avatarError() || bannerError()) && (
                    <p class="text-xs text-destructive sm:text-end">
                      {avatarError() || bannerError()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section class="space-y-3">
            <h3 class={settingsSectionTitle}>
              {t('settings.profile.detailsTitle')}
            </h3>
            <div class="space-y-2">
              <div class={fieldCard}>
                <div class={fieldIcon}>
                  <i class="fa-solid fa-signature text-sm" />
                </div>
                <div class="min-w-0 flex-1 space-y-2">
                  <label class="text-[15px] font-semibold text-foreground">{t('settings.profile.displayName')}</label>
                  <Input
                    value={displayNameDraft()}
                    onInput={(e) => {
                      setDisplayNameDraft(e.currentTarget.value);
                      markDirty();
                    }}
                    disabled={savingProfile()}
                    error={profileError() || undefined}
                    class="rounded-lg border-border bg-background/60"
                  />
                  <p class="text-xs text-muted-foreground">{t('settings.profile.displayNameHint')}</p>
                </div>
              </div>
              <div class={fieldCard}>
                <div class={fieldIcon}>
                  <i class="fa-solid fa-venus-mars text-sm" />
                </div>
                <div class="min-w-0 flex-1 space-y-2">
                  <label class="text-[15px] font-semibold text-foreground">{t('settings.profile.pronouns')}</label>
                  <Input
                    value={pronounsDraft()}
                    maxLength={40}
                    placeholder={t('settings.profile.pronounsPlaceholder')}
                    onInput={(e) => {
                      setPronounsDraft(e.currentTarget.value);
                      markDirty();
                    }}
                    disabled={savingProfile()}
                    class="rounded-lg border-border bg-background/60"
                  />
                  <p class="text-xs text-muted-foreground">{t('settings.profile.pronounsHint')}</p>
                </div>
              </div>
              <div class={fieldCard}>
                <div class={fieldIcon}>
                  <i class="fa-regular fa-note-sticky text-sm" />
                </div>
                <div class="min-w-0 flex-1 space-y-2">
                  <label class="text-[15px] font-semibold text-foreground">{t('settings.profile.aboutMe')}</label>
                  <Textarea
                    value={aboutMeDraft()}
                    onInput={(e) => {
                      setAboutMeDraft(e.currentTarget.value);
                      markDirty();
                    }}
                    disabled={savingProfile()}
                    rows={2}
                    placeholder={t('settings.profile.aboutMePlaceholder')}
                    class="min-h-[52px] border-border bg-background/60"
                  />
                  <p class="text-xs text-muted-foreground">{t('settings.profile.aboutMeHint')}</p>
                </div>
              </div>
              <div class={fieldCard}>
                <div class={fieldIcon}>
                  <i class="fa-solid fa-align-left text-sm" />
                </div>
                <div class="min-w-0 flex-1 space-y-2">
                  <label class="text-[15px] font-semibold text-foreground">{t('settings.profile.bio')}</label>
                  <Textarea
                    value={bioDraft()}
                    onInput={(e) => {
                      setBioDraft(e.currentTarget.value);
                      markDirty();
                    }}
                    disabled={savingProfile()}
                    rows={10}
                    placeholder={t('settings.profile.bioPlaceholder')}
                    class="min-h-[200px] border-border bg-background/60"
                  />
                  <p class="text-xs text-muted-foreground">{t('settings.profile.bioHint')}</p>
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
              <div class={fieldCard}>
                <div class={fieldIcon}>
                  <i class="fa-solid fa-at text-sm" />
                </div>
                <div class="min-w-0 flex-1 space-y-2">
                  <label class="text-[15px] font-semibold text-foreground">{t('settings.profile.username')}</label>
                  <p class="rounded-lg border border-border/80 bg-background/50 px-3 py-2.5 font-mono text-sm text-muted-foreground" dir="ltr">
                    {user()?.username}#{discriminatorStr()}
                  </p>
                  <p class="text-xs text-muted-foreground">{t('settings.profile.usernameHint')}</p>
                </div>
              </div>
            </div>
          </section>

          <section class="space-y-3">
            <h3 class={settingsSectionTitle}>
              {t('settings.profile.birthdayTitle')}
            </h3>
            <div class={fieldCard}>
              <div class={fieldIcon}>
                <i class="fa-solid fa-cake-candles text-sm" />
              </div>
              <div class="min-w-0 flex-1 space-y-1">
                <p class="text-[15px] font-semibold text-foreground">{t('settings.profile.birthdayShow')}</p>
                <p class="text-xs leading-snug text-muted-foreground">{t('settings.profile.birthdayShowHint')}</p>
                <p class="text-xs text-muted-foreground">
                  <Show
                    when={birthdayLabel()}
                    fallback={<span>{t('settings.profile.birthdayNone')}</span>}
                  >
                    {(date) => t('settings.profile.birthdayYours', { date: date() })}
                  </Show>
                </p>
                <Show when={birthdayError()}>
                  <p class="text-xs text-destructive">{birthdayError()}</p>
                </Show>
              </div>
              <div class="flex shrink-0 items-center self-center">
                <Toggle
                  checked={birthdayOptIn()}
                  disabled={birthdayBusy()}
                  label={t('settings.profile.birthdayShow')}
                  onChange={(on) => void toggleBirthdayOptIn(on)}
                />
              </div>
            </div>
          </section>

          <section class="space-y-3">
            <h3 class={settingsSectionTitle}>
              {t('settings.profile.accountTitle')}
            </h3>
            <div class="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyUserId}>
                <i class="fa-regular fa-copy me-2 text-xs" />
                {t('userArea.copyUserId')}
              </Button>
            </div>
            <div class="pt-1">
              <Button variant="destructive" size="md" onClick={handleLogout}>
                <i class="fa-solid fa-right-from-bracket me-2" />
                {t('settings.profile.logOut')}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};
