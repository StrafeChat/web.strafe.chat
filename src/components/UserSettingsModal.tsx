import type { Component } from 'solid-js';
import { createSignal, Show, createEffect } from 'solid-js';
import { Portal } from 'solid-js/web';
import { auth } from '../stores/auth';
import { userSettingsOpen, closeUserSettings } from '../stores/userSettingsModal';
import { type SectionId } from './settings';
import { SettingsSidebar, SettingsPanel, ProfileSettingsPage, AppearanceSettingsPage } from './settings';
import { appDialogPanel, appModalBackdrop, appModalPanel } from '../theme/appChrome';

const EXIT_MS = 200;

export const UserSettingsModal: Component = () => {
  const [section, setSection] = createSignal<SectionId>('account');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isExiting, setIsExiting] = createSignal(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = createSignal(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = createSignal(false);
  const [isSavingProfile, setIsSavingProfile] = createSignal(false);
  const saveProfileRef: { current: (() => void) | null } = { current: null };

  const user = () => auth.user;
  const displayName = () => user()?.display_name || user()?.username || '';

  createEffect(() => {
    if (!userSettingsOpen() && !isExiting()) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  createEffect(() => {
    if (!userSettingsOpen()) {
      setSection('account');
      setShowDiscardConfirm(false);
    }
  });

  function doClose() {
    if (isExiting()) return;
    setIsExiting(true);
    setShowDiscardConfirm(false);
    setTimeout(() => {
      closeUserSettings();
      setIsExiting(false);
    }, EXIT_MS);
  }

  function requestClose() {
    if (isExiting()) return;
    if (hasUnsavedChanges()) {
      setShowDiscardConfirm(true);
      return;
    }
    doClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).hasAttribute('data-settings-backdrop')) requestClose();
  }

  function handleSaveProfile() {
    saveProfileRef.current?.();
  }

  return (
    <Show when={userSettingsOpen() || isExiting()}>
      <Portal>
        <div
          data-settings-backdrop
          data-modal
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-settings-title"
          class={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${appModalBackdrop} ${isExiting() ? 'settings-overlay-out' : 'settings-overlay-in'}`}
          onClick={handleBackdropClick}
        >
          <div
            class={`flex min-h-0 min-w-0 overflow-hidden ${appModalPanel} ${isExiting() ? 'settings-panel-out' : 'settings-panel-in'}`}
            style={{
              width: 'min(92vw, 56rem)',
              height: 'min(85vh, 44rem)',
              'min-height': 'min(400px, 85vh)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <SettingsSidebar
              section={section()}
              onSectionChange={setSection}
              searchQuery={searchQuery()}
              onSearchChange={setSearchQuery}
              displayName={displayName()}
              userId={user()?.id ?? ''}
            />
            <SettingsPanel
              section={section()}
              onClose={requestClose}
              showHeaderSave={section() === 'account' && hasUnsavedChanges()}
              onSave={handleSaveProfile}
              isSaving={isSavingProfile()}
            >
              <div class={section() === 'account' ? 'contents' : 'hidden'} aria-hidden={section() !== 'account'}>
                <ProfileSettingsPage
                  onDirtyChange={setHasUnsavedChanges}
                  registerSaveHandler={(fn) => { saveProfileRef.current = fn; }}
                  onSavingChange={setIsSavingProfile}
                />
              </div>
              <div class={section() === 'appearance' ? 'contents' : 'hidden'} aria-hidden={section() !== 'appearance'}>
                <AppearanceSettingsPage />
              </div>
            </SettingsPanel>
          </div>

          <Show when={showDiscardConfirm()}>
            <div
              class={`fixed inset-0 z-[60] flex items-center justify-center ${appModalBackdrop}`}
              onClick={() => setShowDiscardConfirm(false)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="discard-dialog-title"
            >
              <div
                class={`mx-4 max-w-sm p-6 ${appDialogPanel}`}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="discard-dialog-title" class="text-lg font-semibold text-foreground mb-2">
                  Unsaved changes
                </h3>
                <p class="text-sm text-muted-foreground mb-4">
                  You have unsaved changes. Discard them and close?
                </p>
                <div class="flex gap-3 justify-end">
                  <button
                    type="button"
                    class="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    onClick={() => setShowDiscardConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
                    onClick={doClose}
                  >
                    Discard
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </Portal>
    </Show>
  );
};
