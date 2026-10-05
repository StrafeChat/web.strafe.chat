import type { Component } from 'solid-js';
import { createSignal, createMemo, Show, createEffect } from 'solid-js';
import { userSettingsOpen, closeUserSettings, takePendingSettingsSection, hasPendingSettingsSection } from '../stores/userSettingsModal';
import { confirmDialog } from '../stores/confirmDialog';
import { getInstanceCapabilities } from '../api/instance';
import { ACCOUNT_ITEMS, APP_ITEMS, INSTANCE_ITEM, DEVELOPERS_ITEM, sectionDescription, sectionTitle, type SectionId, type SettingsNavItem } from './settings/types.js';
import {
  SettingsShell,
  SettingsNav,
  SettingsPanel,
  ProfileSettingsPage,
  AppearanceSettingsPage,
  LanguageSettingsPage,
  DevicesSettingsPage,
  SecuritySettingsPage,
  NotificationsSettingsPage,
  VoiceVideoSettingsPage,
  AccessibilitySettingsPage,
  KeybindsSettingsPage,
  InstanceSettingsPage,
  DevelopersSettingsPage,
  AuthorizedAppsSettingsPage,
  type SettingsNavGroup,
} from './settings';
import { SearchInput } from './ui/SearchInput';
import { Button } from './ui/Button';
import { t } from '../i18n';

function navMatches(item: SettingsNavItem, q: string): boolean {
  if (!q) return true;
  const n = q.toLowerCase();
  return t(item.labelKey).toLowerCase().includes(n) || item.id.toLowerCase().includes(n);
}

export const UserSettingsModal: Component = () => {
  const [section, setSection] = createSignal<SectionId>('account');
  // Asked of the server rather than inferred: only it knows who administers the instance.
  // Failing closed simply hides the section, which is the right way to be wrong.
  const [isInstanceAdmin, setIsInstanceAdmin] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = createSignal(false);
  const [confirming, setConfirming] = createSignal(false);
  const [isSavingProfile, setIsSavingProfile] = createSignal(false);
  const saveProfileRef: { current: (() => void) | null } = { current: null };

  createEffect(() => {
    if (userSettingsOpen()) {
      const s = takePendingSettingsSection();
      if (s) setSection(s);
      void getInstanceCapabilities()
        .then((res) => setIsInstanceAdmin(res.instance_admin))
        .catch(() => setIsInstanceAdmin(false));
    } else {
      setSection('account');
    }
  });

  const navGroups = createMemo((): SettingsNavGroup<SectionId>[] => {
    const q = searchQuery().trim();
    const toDef = (i: SettingsNavItem) => ({ id: i.id, label: t(i.labelKey), icon: i.icon });
    const account = ACCOUNT_ITEMS.filter((i) => navMatches(i, q)).map(toDef);
    const app = APP_ITEMS.filter((i) => navMatches(i, q)).map(toDef);
    const groups: SettingsNavGroup<SectionId>[] = [];
    if (account.length) groups.push({ label: t('settings.groups.account'), items: account });
    if (app.length) groups.push({ label: t('settings.groups.app'), items: app });
    if (navMatches(DEVELOPERS_ITEM, q)) {
      groups.push({ label: t('settings.groups.developers'), items: [toDef(DEVELOPERS_ITEM)] });
    }
    if (isInstanceAdmin() && navMatches(INSTANCE_ITEM, q)) {
      groups.push({ label: t('settings.sections.instance.title'), items: [toDef(INSTANCE_ITEM)] });
    }
    return groups;
  });

  function doClose() {
    closeUserSettings();
  }

  async function requestClose() {
    if (confirming()) return;
    if (hasUnsavedChanges()) {
      setConfirming(true);
      try {
        const discard = await confirmDialog({
          title: t('settings.unsaved.title'),
          body: t('settings.unsaved.body'),
          confirmLabel: t('common.discard'),
          tone: 'danger',
        });
        if (!discard) return;
      } finally {
        setConfirming(false);
      }
    }
    doClose();
  }

  function handleSaveProfile() {
    saveProfileRef.current?.();
  }

  return (
    <>
      <SettingsShell
        open={userSettingsOpen()}
        onClose={() => void requestClose()}
        labelledBy="user-settings-title"
        initialMobileView={hasPendingSettingsSection() ? 'panel' : 'nav'}
      >
        <SettingsNav<SectionId>
          title={t('settings.title')}
          groups={navGroups()}
          active={section()}
          onSelect={(id) => setSection(id)}
          header={
            <SearchInput
              size="md"
              value={searchQuery()}
              onValueChange={setSearchQuery}
              placeholder={t('common.search')}
              aria-label={t('settings.searchAria')}
              class="border-border/80 bg-muted/40"
            />
          }
          footer={
            <p class="text-[10px] leading-relaxed text-muted-foreground/80" title={__BUILD_ID__}>
              Public beta · v{__APP_VERSION__}
            </p>
          }
        />
        <SettingsPanel
          title={sectionTitle(section())}
          description={sectionDescription(section())}
          titleId="user-settings-title"
          onClose={() => void requestClose()}
          headerActions={
            <Show when={section() === 'account' && hasUnsavedChanges()}>
              <Button size="sm" loading={isSavingProfile()} onClick={handleSaveProfile}>
                <Show when={!isSavingProfile()}>
                  <i class="fa-solid fa-check text-xs" aria-hidden="true" />
                </Show>
                {t('common.saveChanges')}
              </Button>
            </Show>
          }
        >
          <div class={section() === 'account' ? 'contents' : 'hidden'} aria-hidden={section() !== 'account'}>
            <ProfileSettingsPage
              onDirtyChange={setHasUnsavedChanges}
              registerSaveHandler={(fn) => {
                saveProfileRef.current = fn;
              }}
              onSavingChange={setIsSavingProfile}
            />
          </div>
          <div class={section() === 'appearance' ? 'contents' : 'hidden'} aria-hidden={section() !== 'appearance'}>
            <AppearanceSettingsPage />
          </div>
          <div class={section() === 'language' ? 'contents' : 'hidden'} aria-hidden={section() !== 'language'}>
            <LanguageSettingsPage />
          </div>
          <div class={section() === 'devices' ? 'contents' : 'hidden'} aria-hidden={section() !== 'devices'}>
            <DevicesSettingsPage />
          </div>
          <Show when={section() === 'security'}>
            <SecuritySettingsPage />
          </Show>
          <Show when={section() === 'accessibility'}>
            <AccessibilitySettingsPage />
          </Show>
          <Show when={section() === 'voice'}>
            <VoiceVideoSettingsPage />
          </Show>
          <Show when={section() === 'notifications'}>
            <NotificationsSettingsPage />
          </Show>
          <Show when={section() === 'instance' && isInstanceAdmin()}>
            <InstanceSettingsPage />
          </Show>
          <Show when={section() === 'developers'}>
            <DevelopersSettingsPage />
          </Show>
          <Show when={section() === 'authorizedApps'}>
            <AuthorizedAppsSettingsPage />
          </Show>
          <Show when={section() === 'keybinds'}>
            <KeybindsSettingsPage />
          </Show>
        </SettingsPanel>
      </SettingsShell>

    </>
  );
};
