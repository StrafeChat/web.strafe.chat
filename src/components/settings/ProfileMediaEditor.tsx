import type { Component, JSX } from 'solid-js';
import { Show } from 'solid-js';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { PresenceDot } from '../PresenceDot';
import { ProfileBanner } from '../ProfileBanner';
import { t } from '../../i18n';

/** The cap the picker enforces before anything is uploaded; the server checks again. */
export const PROFILE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export interface ProfileMediaEditorProps {
  /** Its first letter stands in for a missing avatar. */
  name: string;
  /** Whose presence dot sits on the avatar. */
  userId: string;
  avatar?: string;
  banner?: string;
  avatarUploading: boolean;
  bannerUploading: boolean;
  /** A picked file that passed the type and size checks; the page uploads it. */
  onAvatarFile: (file: File) => void;
  onBannerFile: (file: File) => void;
  /** A picked file that failed them, with the message to show. */
  onInvalidFile: (kind: 'avatar' | 'banner', message: string) => void;
  error?: string;
  /** Accessible names of the two pickers; the main profile's wording when unset. */
  avatarLabel?: string;
  bannerLabel?: string;
  /** End-aligned under the hint and error (the space profile's remove buttons). */
  actions?: JSX.Element;
}

/**
 * The banner and avatar card of a profile editor: click either to pick an image. One
 * component so the main profile and space profiles pick, check and show images the same way;
 * what happens to a file (which endpoint, which store) stays with the page.
 */
export const ProfileMediaEditor: Component<ProfileMediaEditorProps> = (props) => {
  let avatarFileInput: HTMLInputElement | undefined;
  let bannerFileInput: HTMLInputElement | undefined;

  function onSelected(kind: 'avatar' | 'banner', e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    // Cleared at once so picking the same file again still fires a change.
    input.value = '';
    if (!file) return;
    // An empty file is no image whatever its name says; the server would only refuse it
    // after the round trip.
    if (!file.type.startsWith('image/') || file.size === 0) {
      props.onInvalidFile(kind, t('settings.profile.imageTypeError'));
      return;
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      props.onInvalidFile(kind, t('settings.profile.imageSizeError'));
      return;
    }
    if (kind === 'avatar') props.onAvatarFile(file);
    else props.onBannerFile(file);
  }

  return (
    <div class="overflow-hidden rounded-xl border border-border bg-muted/15 shadow-sm">
      <input
        ref={(el) => {
          avatarFileInput = el;
        }}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        class="hidden"
        onChange={(e) => onSelected('avatar', e)}
      />
      <input
        ref={(el) => {
          bannerFileInput = el;
        }}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        class="hidden"
        onChange={(e) => onSelected('banner', e)}
      />
      <button
        type="button"
        disabled={props.bannerUploading}
        title={t('settings.profile.changeBanner')}
        aria-label={props.bannerLabel ?? t('settings.profile.changeBannerAria')}
        class="group/banner relative block w-full cursor-pointer border-0 bg-transparent p-0 text-start outline-none ring-inset ring-ring transition focus-visible:ring-2 disabled:cursor-wait disabled:opacity-70"
        onClick={() => {
          if (!props.bannerUploading) bannerFileInput?.click();
        }}
      >
        <ProfileBanner
          banner={props.banner}
          fit="natural"
          class="pointer-events-none max-h-36 sm:max-h-44"
        />
        <span class="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover/banner:bg-black/50 group-focus-visible/banner:bg-black/45" />
        <span class="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm font-medium text-white opacity-0 transition-opacity group-hover/banner:opacity-100 group-focus-visible/banner:opacity-100">
          {t('settings.profile.changeBanner')}
        </span>
        <Show when={props.bannerUploading}>
          <span class="absolute inset-0 z-[1] flex items-center justify-center bg-background/60 text-sm font-medium text-foreground backdrop-blur-[2px]">
            {t('common.uploading')}
          </span>
        </Show>
      </button>
      <div class="flex flex-col gap-3 px-4 pb-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <button
          type="button"
          disabled={props.avatarUploading}
          title={t('settings.profile.changeAvatar')}
          aria-label={props.avatarLabel ?? t('settings.profile.changeAvatarAria')}
          class="group/avatar relative -mt-12 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none ring-offset-2 ring-offset-card transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70 sm:-mt-14"
          onClick={() => {
            if (!props.avatarUploading) avatarFileInput?.click();
          }}
        >
          <span class="relative block rounded-full">
            <MessageAvatar
              name={props.name}
              avatar={props.avatar}
              class="pointer-events-none size-20 border-[3px] border-card bg-primary text-xl text-primary-foreground shadow-md sm:size-[5.25rem] sm:text-2xl"
            />
            <span class="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition-colors group-hover/avatar:bg-black/55 group-focus-visible/avatar:bg-black/50" />
            <span class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full px-2 text-center text-[10px] font-semibold leading-tight text-white opacity-0 transition-opacity group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100 sm:text-xs">
              {t('settings.profile.changeAvatar')}
            </span>
          </span>
          <span class="pointer-events-none absolute bottom-1 right-1 z-[1]">
            <PresenceDot userId={props.userId} class="size-4" />
          </span>
          <Show when={props.avatarUploading}>
            <span class="absolute inset-0 z-[2] flex items-center justify-center rounded-full bg-background/60 text-[11px] font-medium text-foreground backdrop-blur-[2px]">
              …
            </span>
          </Show>
        </button>
        <div class="flex min-w-0 flex-1 flex-col gap-1 sm:items-end sm:pb-1">
          <p class="text-[11px] text-muted-foreground sm:text-end">{t('settings.profile.mediaHint')}</p>
          <Show when={props.error}>
            <p class="text-xs text-destructive sm:text-end">{props.error}</p>
          </Show>
          {props.actions}
        </div>
      </div>
    </div>
  );
};
