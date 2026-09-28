import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { recoveryPrompt, setRecoveryPrompt } from '../stores/recoveryPrompt';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { Button } from './ui/Button';
import { appDialogActions, zLayer } from '../theme/appChrome';
import { t } from '../i18n';

export const E2eeEnvironmentModal: Component = () => {
  const message = () => recoveryPrompt.e2eeEnvironmentError;

  function dismiss() {
    setRecoveryPrompt('e2eeEnvironmentError', null);
  }

  return (
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
  );
};
