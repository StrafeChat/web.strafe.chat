import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { recoveryPrompt, setRecoveryPrompt } from '../stores/recoveryPrompt';
import { auth } from '../stores/auth';
import { forgetLocalDeviceIdentities, resetLocalE2eeStore } from '../lib/e2ee/machine';
import { isDesktop } from '../desktop/env';
import { wipeWebviewStorageAndRestart } from '../desktop/native';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { Button } from './ui/Button';
import { appDialogActions, zLayer } from '../theme/appChrome';
import { t } from '../i18n';

/**
 * The two "encryption cannot work on this device" dialogs: no Web Crypto (nothing to do but
 * explain), and a local store the engine cannot open (explain, and offer the reset that
 * gives the device a fresh identity - history comes back from the recovery backup).
 */
export const E2eeEnvironmentModal: Component = () => {
  const message = () => recoveryPrompt.e2eeEnvironmentError;
  const storeError = () => recoveryPrompt.e2eeStoreError;
  const [resetting, setResetting] = createSignal(false);
  const [resetError, setResetError] = createSignal('');

  function dismiss() {
    setRecoveryPrompt('e2eeEnvironmentError', null);
  }

  function dismissStore() {
    if (resetting()) return;
    setResetError('');
    setRecoveryPrompt('e2eeStoreError', null);
  }

  async function reset() {
    const userId = auth.user?.id;
    if (!userId) return;
    setResetError('');
    setResetting(true);
    try {
      if (isDesktop()) {
        // In the app the shell deletes the files at restart: WebKit's database server has
        // usually crashed on the unreadable store by now, and in-page deletion dies with it.
        await forgetLocalDeviceIdentities(userId);
        await wipeWebviewStorageAndRestart();
        return;
      }
      await resetLocalE2eeStore(userId);
      // A fresh page: the engine, the gateway and every store belong to one device identity.
      window.location.reload();
    } catch (e) {
      console.error('[e2ee] store reset failed', e);
      setResetError(t('e2ee.storeResetFailed', { error: e instanceof Error ? e.message : String(e) }));
      setResetting(false);
    }
  }

  return (
    <>
      <Show when={message()}>
        <ResponsiveDialog
          size="md"
          zClass={zLayer.critical}
          onClose={dismiss}
          title={t('e2ee.environmentTitle')}
          description={<span class="whitespace-pre-line">{message()}</span>}
          icon="fa-solid fa-lock-open"
          tone="warning"
        >
          <div class={appDialogActions}>
            <Button onClick={dismiss} data-autofocus>
              {t('common.gotIt')}
            </Button>
          </div>
        </ResponsiveDialog>
      </Show>

      <Show when={storeError()}>
        {(err) => (
          <ResponsiveDialog
            size="md"
            zClass={zLayer.critical}
            onClose={dismissStore}
            title={t('e2ee.storeTitle')}
            description={t('e2ee.storeBody')}
            icon="fa-solid fa-database"
            tone="warning"
          >
            <p class="text-sm leading-relaxed text-muted-foreground">{t('e2ee.storeConsequence')}</p>
            <p class="mt-3 break-all rounded-md bg-muted/40 px-3 py-2 font-mono text-[11px] leading-snug text-muted-foreground" dir="ltr">
              {err().store}: {err().detail}
            </p>
            <Show when={resetError()}>
              <p class="mt-3 text-xs text-destructive" role="alert">
                {resetError()}
              </p>
            </Show>
            <div class={appDialogActions}>
              <Button variant="outline" disabled={resetting()} onClick={dismissStore}>
                {t('e2ee.storeLater')}
              </Button>
              <Button loading={resetting()} onClick={() => void reset()} data-autofocus>
                {t('e2ee.storeReset')}
              </Button>
            </div>
          </ResponsiveDialog>
        )}
      </Show>
    </>
  );
};
