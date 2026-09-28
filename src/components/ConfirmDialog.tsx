import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { confirmDialogState, settleConfirmDialog } from '../stores/confirmDialog';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { Button } from './ui/Button';
import { appDialogActions, zLayer } from '../theme/appChrome';
import { t } from '../i18n';

/** Renders whatever `confirmDialog()` is currently asking. Mounted once in the root layout. */
export const ConfirmDialog: Component = () => (
  <Show when={confirmDialogState.pending}>
    {(pending) => {
      const opts = () => pending().options;
      const danger = () => opts().tone === 'danger';
      return (
        <ResponsiveDialog
          size="sm"
          zClass={zLayer.confirm}
          onClose={() => settleConfirmDialog(false)}
          title={opts().title}
          description={opts().body}
          icon={opts().icon ?? (danger() ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-question')}
          tone={danger() ? 'danger' : 'default'}
        >
          <div class={appDialogActions}>
            <Button variant="outline" onClick={() => settleConfirmDialog(false)} data-autofocus>
              {opts().cancelLabel ?? t('common.cancel')}
            </Button>
            <Button variant={danger() ? 'destructive' : 'primary'} onClick={() => settleConfirmDialog(true)}>
              {opts().confirmLabel ?? t('common.confirm')}
            </Button>
          </div>
        </ResponsiveDialog>
      );
    }}
  </Show>
);
