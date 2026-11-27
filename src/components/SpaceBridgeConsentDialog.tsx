import type { Component } from 'solid-js';
import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { setMySpaceBridgeConsent, type SpaceBridgeConsent } from '../api/bridges';
import {
  bridges,
  ensureAccountBridgeConsent,
  ensureSpaceBridgeConsent,
  myBridgeConsentIn,
  roomBridges,
  setSpaceConsentLocal,
  spaceBridgeConsentMode,
} from '../stores/bridges';
import { closeSpaceBridgeConsent, spaceBridgeConsentFor } from '../stores/bridgeConsentDialog';
import { spaces } from '../stores/spaces';
import { auth } from '../stores/auth';
import { openUserSettings } from '../stores/userSettingsModal';
import { translateCaughtApiError } from '../lib/formatApiError';
import { BRIDGES_LEARN_MORE } from '../lib/bridgePlatforms';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { Button } from './ui/Button';
import { bridgedPlatformsLabel } from './room/RoomBridgeBadge';
import { appDialogActions, zLayer } from '../theme/appChrome';
import { t } from '../i18n';

const CHOICES: SpaceBridgeConsent[] = ['inherit', 'allow', 'deny'];

/**
 * Space menu > Bridge privacy (spec 5.9): may bridges in this space copy my messages to other
 * platforms? Follow my account default (and the space's mode), always allow, or never allow.
 * The server enforces the answer on every bridge's feed; turning it to "don't allow" also tells
 * the space's bridges which of my messages they already copied, so they can delete those copies.
 */
export const SpaceBridgeConsentDialog: Component = () => {
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal('');
  const spaceId = () => spaceBridgeConsentFor();
  const space = createMemo(() => spaces.spaces.find((s) => s.id === spaceId()));

  createEffect(() => {
    const sid = spaceId();
    if (!sid) return;
    setErr('');
    void ensureAccountBridgeConsent();
    void ensureSpaceBridgeConsent(sid);
  });

  const current = () => {
    const sid = spaceId();
    return (sid && bridges.bySpace[sid]?.state) || 'inherit';
  };
  const loaded = () => {
    const sid = spaceId();
    return !!sid && bridges.bySpace[sid] !== undefined;
  };
  const optIn = () => spaceBridgeConsentMode(spaceId() ?? undefined) === 'optin';
  const accountDeny = () => (bridges.account ?? auth.user?.bridge_consent) === 'deny';
  /** What "follow my default" means here. */
  const inheritText = () => (accountDeny() ? t('bridges.consent.inheritDeny') : optIn() ? t('bridges.consent.inheritOptIn') : t('bridges.consent.inheritOptOut'));
  /** The space's bridged rooms, named by platform, so the choice is concrete. */
  const bridgedHere = createMemo(() => {
    const sid = spaceId();
    if (!sid) return '';
    const list = (spaces.spaceRoomsBySpaceId[sid] ?? []).flatMap((r) => roomBridges(sid, r.id));
    return bridgedPlatformsLabel(list);
  });

  async function choose(state: SpaceBridgeConsent) {
    const sid = spaceId();
    if (!sid || busy() || state === current()) return;
    setBusy(true);
    setErr('');
    try {
      await setMySpaceBridgeConsent(sid, state);
      setSpaceConsentLocal(sid, state);
    } catch (e) {
      setErr(translateCaughtApiError(e, t).join(' '));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={spaceId()}>
      {(sid) => (
        <ResponsiveDialog
          size="md"
          zClass={zLayer.modal}
          onClose={closeSpaceBridgeConsent}
          title={t('bridges.consent.spaceTitle')}
          description={space()?.name}
          icon="fa-solid fa-bridge"
        >
          <div class="space-y-3" data-bridge-consent-dialog>
            <p class="text-sm text-muted-foreground">
              {bridgedHere() ? t('bridges.consent.spaceIntroBridged', { platforms: bridgedHere() }) : t('bridges.consent.spaceIntro')}
            </p>
            <div role="radiogroup" aria-label={t('bridges.consent.spaceTitle')} class="space-y-2">
              <For each={CHOICES}>
                {(c) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={current() === c}
                    disabled={busy() || !loaded()}
                    data-consent-choice={c}
                    class={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors disabled:opacity-60 ${
                      current() === c ? 'border-primary/60 bg-primary/10' : 'border-border/70 bg-card/10 hover:bg-accent/40'
                    }`}
                    onClick={() => void choose(c)}
                  >
                    <span
                      class={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                        current() === c ? 'border-primary' : 'border-muted-foreground/50'
                      }`}
                      aria-hidden="true"
                    >
                      <Show when={current() === c}>
                        <span class="size-2 rounded-full bg-primary" />
                      </Show>
                    </span>
                    <span class="min-w-0">
                      <span class="block text-sm font-medium text-foreground">{t(`bridges.consent.choice.${c}`)}</span>
                      <span class="block text-xs text-muted-foreground">
                        {c === 'inherit' ? inheritText() : t(`bridges.consent.choiceHelp.${c}`)}
                      </span>
                    </span>
                  </button>
                )}
              </For>
            </div>
            <p class="rounded-lg bg-muted/30 px-3 py-2 text-xs text-foreground" data-bridge-consent-effective={myBridgeConsentIn(sid())}>
              {myBridgeConsentIn(sid()) === 'allow' ? t('bridges.consent.effectiveAllow') : t('bridges.consent.effectiveDeny')}
            </p>
            <p class="text-xs text-muted-foreground">{t('bridges.consent.denyNote')}</p>
            <Show when={err()}>
              <p class="text-sm text-destructive" role="alert">{err()}</p>
            </Show>
            <div class={appDialogActions}>
              <Button
                variant="ghost"
                onClick={() => {
                  closeSpaceBridgeConsent();
                  openUserSettings('privacy');
                }}
              >
                {t('bridges.consent.accountDefault')}
              </Button>
              <a href={BRIDGES_LEARN_MORE} target="_blank" rel="noopener" class="self-center text-xs font-medium text-primary hover:underline">
                {t('bridges.learnMore')}
              </a>
              <Button onClick={closeSpaceBridgeConsent} data-autofocus>
                {t('common.done')}
              </Button>
            </div>
          </div>
        </ResponsiveDialog>
      )}
    </Show>
  );
};
