import type { Component } from 'solid-js';
import { createSignal, onMount, createEffect } from 'solid-js';
import { auth, setAuthUser, logout } from '../../stores/auth';
import { getMe, patchMe } from '../../api/users';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PresenceDot } from '../PresenceDot';
import { formatDiscriminator } from './types.js';
import { useNavigate } from '@solidjs/router';
import { closeUserSettings } from '../../stores/userSettingsModal';

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
  const [profileLoaded, setProfileLoaded] = createSignal(false);
  const [savingProfile, setSavingProfile] = createSignal(false);
  const [profileError, setProfileError] = createSignal('');
  const [hasDirty, setHasDirty] = createSignal(false);
  const [lastSavedName, setLastSavedName] = createSignal(getInitialName().trim());
  const [lastSavedBio, setLastSavedBio] = createSignal('');
  const [lastSavedAboutMe, setLastSavedAboutMe] = createSignal('');

  function markDirty() {
    setHasDirty(true);
    props.onDirtyChange?.(true);
  }
  function markClean() {
    setHasDirty(false);
    props.onDirtyChange?.(false);
  }

  const user = () => auth.user;
  const discriminatorStr = () => formatDiscriminator(user()?.discriminator ?? 0);
  const displayName = () => user()?.display_name || user()?.username || '';

  createEffect(() => {
    props.registerSaveHandler?.(() => saveProfile());
  });

  onMount(() => {
    getMe()
      .then((me) => {
        const name = (me.display_name || me.username || '').trim();
        const bio = (me.bio ?? '').trim();
        const about = (me.about_me ?? '').trim();
        setDisplayNameDraft(me.display_name || me.username || '');
        setBioDraft(me.bio ?? '');
        setAboutMeDraft(me.about_me ?? '');
        setLastSavedName(name);
        setLastSavedBio(bio);
        setLastSavedAboutMe(about);
        setProfileLoaded(true);
        markClean();
      })
      .catch(() => {
        const u = auth.user;
        const name = u ? (u.display_name || u.username || '').trim() : '';
        setDisplayNameDraft(u?.display_name || u?.username || '');
        setLastSavedName(name);
        setLastSavedBio('');
        setLastSavedAboutMe('');
        setProfileLoaded(true);
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
      await patchMe({
        display_name: name || undefined,
        bio: bio || undefined,
        about_me: about || undefined,
      });
      setAuthUser({ ...u, display_name: name || u.display_name });
      setLastSavedName(name);
      setLastSavedBio(bio);
      setLastSavedAboutMe(about);
      markClean();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSavingProfile(false);
      props.onSavingChange?.(false);
    }
  }

  function copyUserId() {
    if (user()?.id) navigator.clipboard.writeText(user()!.id);
  }

  function handleLogout() {
    logout();
    closeUserSettings();
    navigate('/login');
  }

  return (
    <>
      <div class="flex-1 min-w-0 max-w-xl space-y-8">
        <section class="space-y-4">
          <h4 class="text-sm font-semibold text-foreground">Profile customization</h4>
          <p class="text-sm text-muted-foreground">Edit your profile and see a live preview.</p>
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">Display name</label>
            <Input
              value={displayNameDraft()}
              onInput={(e) => {
                setDisplayNameDraft(e.currentTarget.value);
                markDirty();
              }}
              disabled={savingProfile()}
              error={profileError() || undefined}
              class="rounded-lg bg-muted/50 border-border"
            />
            <p class="text-xs text-muted-foreground">This is how your name appears to others.</p>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">Bio</label>
            <textarea
              value={bioDraft()}
              onInput={(e) => {
                setBioDraft(e.currentTarget.value);
                markDirty();
              }}
              disabled={savingProfile()}
              rows={2}
              placeholder="Short bio"
              class="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-y min-h-[60px]"
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">About me</label>
            <textarea
              value={aboutMeDraft()}
              onInput={(e) => {
                setAboutMeDraft(e.currentTarget.value);
                markDirty();
              }}
              disabled={savingProfile()}
              rows={3}
              placeholder="A bit about you"
              class="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-y min-h-[80px]"
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">Username</label>
            <p class="text-sm text-muted-foreground py-2 px-3 rounded-lg bg-muted/30 border border-border">
              {user()?.username}#{discriminatorStr()}
            </p>
            <p class="text-xs text-muted-foreground">Your login handle (read-only).</p>
          </div>
          <div class="flex items-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={copyUserId}>
              <i class="fa-regular fa-copy mr-2 text-xs" />
              Copy User ID
            </Button>
          </div>
        </section>
        <section class="pt-4 border-t border-border">
          <Button variant="destructive" size="md" onClick={handleLogout}>
            <i class="fa-solid fa-right-from-bracket mr-2" />
            Log out
          </Button>
        </section>
      </div>
      <div class="w-72 shrink-0 hidden lg:block">
        <div class="sticky top-6 rounded-xl border border-border bg-card overflow-hidden shadow-lg">
          <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 border-b border-border bg-muted/30">
            Profile preview
          </p>
          <div class="h-14 bg-primary/40 w-full" />
          <div class="px-4 pb-4 -mt-8">
            <div class="flex items-end gap-3">
              <div class="relative shrink-0">
                <div class="size-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-lg font-semibold border-[3px] border-card">
                  {displayName()[0]?.toUpperCase() ?? '?'}
                </div>
                <span class="absolute -bottom-0.5 -right-0.5">
                  <PresenceDot userId={user()?.id ?? ''} class="size-4" />
                </span>
              </div>
              <div class="min-w-0 flex-1 pb-0.5">
                <p class="font-semibold text-foreground truncate">{displayNameDraft() || displayName()}</p>
                <p class="text-xs text-muted-foreground truncate">{user()?.username}#{discriminatorStr()}</p>
              </div>
            </div>
            {(bioDraft() || aboutMeDraft()) && (
              <p class="text-sm text-muted-foreground mt-3 line-clamp-2 break-words">
                {bioDraft() || aboutMeDraft()}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
