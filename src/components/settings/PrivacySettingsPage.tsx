import type { Component } from 'solid-js';
import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import { setAccountBridgeConsent } from '../../api/bridges';
import { bridges, ensureAccountBridgeConsent, ensureSpaceBridgeConsent, roomBridges, setAccountConsentLocal } from '../../stores/bridges';
import { openSpaceBridgeConsent } from '../../stores/bridgeConsentDialog';
import { closeUserSettings } from '../../stores/userSettingsModal';
import { spaces } from '../../stores/spaces';
import { auth } from '../../stores/auth';
import { translateCaughtApiError } from '../../lib/formatApiError';
import { BRIDGES_LEARN_MORE } from '../../lib/bridgePlatforms';
import { Toggle } from '../ui/Toggle';
import { settingsGroupFrame, settingsRowIcon, settingsRowShell, settingsSectionTitle } from './settingsChrome';
import { bridgedPlatformsLabel } from '../room/RoomBridgeBadge';
import { t } from '../../i18n';

/**
 * Settings > Privacy > Bridges (spec 5.9): the account default for whether bridges may copy
 * your messages to other platforms (Discord, Matrix, ...). Each space can still be set apart in
 * its own menu (Bridge privacy), and a space in opt-in mode copies nobody who did not opt in.
 * The server enforces this on every bridge's feed - the bridge never gets a list of who said no.
 */
export const PrivacySettingsPage: Component = () => {
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal('');

  onMount(() => void ensureAccountBridgeConsent());

  const allowed = () => (bridges.account ?? auth.user?.bridge_consent ?? null) !== 'deny';
  /** Spaces where a room is bridged: where the choice matters right now. */
  const bridgedSpaces = createMemo(() =>
    spaces.spaces
      .map((sp) => {
        const list = (spaces.spaceRoomsBySpaceId[sp.id] ?? []).flatMap((r) => roomBridges(sp.id, r.id));
        return { space: sp, platforms: bridgedPlatformsLabel(list), count: list.length };
      })
      .filter((x) => x.count > 0)
  );

  onMount(() => {
    for (const x of bridgedSpaces()) void ensureSpaceBridgeConsent(x.space.id);
  });

  async function setAllowed(on: boolean) {
    if (busy()) return;
    setBusy(true);
    setErr('');
    const value = on ? 'allow' : 'deny';
    try {
      await setAccountBridgeConsent(value);
      setAccountConsentLocal(value);
    } catch (e) {
      setErr(translateCaughtApiError(e, t).join(' '));
    } finally {
      setBusy(false);
    }
  }

  const overrideLabel = (spaceId: string) => {
    const s = bridges.bySpace[spaceId]?.state;
    return s === 'allow' ? t('privacy.bridges.spaceAllow') : s === 'deny' ? t('privacy.bridges.spaceDeny') : t('privacy.bridges.spaceInherit');
  };

  return (
    <div class="max-w-2xl space-y-6" data-privacy-settings>
      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('privacy.bridges.title')}</h3>
        <p class="text-xs leading-snug text-muted-foreground">
          {t('privacy.bridges.intro')}{' '}
          <a href={BRIDGES_LEARN_MORE} target="_blank" rel="noopener" class="font-medium text-primary hover:underline">
            {t('bridges.learnMore')}
          </a>
        </p>
        <div class={settingsGroupFrame}>
          <div class={settingsRowShell}>
            <div class={settingsRowIcon}>
              <i class="fa-solid fa-bridge text-sm" aria-hidden="true" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[15px] font-semibold text-foreground">{t('privacy.bridges.allow')}</p>
              <p class="mt-0.5 text-xs leading-snug text-muted-foreground">
                {allowed() ? t('privacy.bridges.allowOn') : t('privacy.bridges.allowOff')}
              </p>
            </div>
            <div class="shrink-0">
              <Toggle
                checked={allowed()}
                disabled={busy() || bridges.account === undefined}
                label={t('privacy.bridges.allow')}
                onChange={(on) => void setAllowed(on)}
              />
            </div>
          </div>
        </div>
        <Show when={err()}>
          <p class="text-sm text-destructive" role="alert">{err()}</p>
        </Show>
        <p class="text-xs leading-snug text-muted-foreground">{t('privacy.bridges.offNote')}</p>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('privacy.bridges.perSpaceTitle')}</h3>
        <p class="text-xs leading-snug text-muted-foreground">{t('privacy.bridges.perSpaceHint')}</p>
        <Show
          when={bridgedSpaces().length > 0}
          fallback={<p class="text-sm text-muted-foreground">{t('privacy.bridges.noBridgedSpaces')}</p>}
        >
          <div class="space-y-1.5">
            <For each={bridgedSpaces()}>
              {(x) => (
                <button
                  type="button"
                  class={`${settingsRowShell} w-full text-start transition-colors hover:bg-accent/30`}
                  onClick={() => {
                    closeUserSettings();
                    openSpaceBridgeConsent(x.space.id);
                  }}
                >
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-foreground">{x.space.name}</p>
                    <p class="mt-0.5 truncate text-xs text-muted-foreground">
                      {t('privacy.bridges.bridgedWith', { platforms: x.platforms })} · {overrideLabel(x.space.id)}
                    </p>
                  </div>
                  <i class="fa-solid fa-chevron-right text-xs text-muted-foreground" aria-hidden="true" />
                </button>
              )}
            </For>
          </div>
        </Show>
      </section>
    </div>
  );
};
