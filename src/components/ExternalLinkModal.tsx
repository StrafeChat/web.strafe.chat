import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import {
  externalLink,
  getDomainFromUrl,
  closeExternalLinkModal,
  confirmExternalLink,
} from '../stores/externalLink';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { Button } from './ui/Button';
import { Checkbox } from './ui/Checkbox';
import { appDialogActions, appSectionLabel, zLayer } from '../theme/appChrome';
import { t } from '../i18n';

export const ExternalLinkModal: Component = () => {
  const [trustDomain, setTrustDomain] = createSignal(false);
  const url = () => externalLink.pendingUrl;
  const domain = () => (url() ? getDomainFromUrl(url()!) : '');

  function handleVisit() {
    confirmExternalLink(trustDomain());
  }

  function handleClose() {
    setTrustDomain(false);
    closeExternalLinkModal();
  }

  return (
    <Show when={url()}>
      <ResponsiveDialog
        size="md"
        zClass={zLayer.modalStacked}
        onClose={handleClose}
        title={t('externalLink.title')}
        description={t('externalLink.body')}
        icon="fa-solid fa-triangle-exclamation"
        tone="warning"
        centered
      >
        <div>
          <p class={`mb-1.5 ${appSectionLabel}`}>{t('externalLink.destination')}</p>
          <div class="break-all rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-sm text-foreground" dir="ltr">
            {url()}
          </div>
        </div>
        <Show when={domain()}>
          <div class="mt-4">
            <Checkbox
              checked={trustDomain()}
              onChange={setTrustDomain}
              label={
                <>
                  {t('externalLink.alwaysTrust')} <strong class="font-semibold text-foreground">{domain()}</strong>
                </>
              }
              description={t('externalLink.alwaysTrustDescription')}
            />
          </div>
        </Show>
        <div class={`${appDialogActions} mt-5`}>
          <Button variant="outline" onClick={handleClose} data-autofocus>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleVisit}>
            {t('externalLink.visit')}
            <i class="fa-solid fa-arrow-up-right-from-square text-xs" aria-hidden="true" />
          </Button>
        </div>
      </ResponsiveDialog>
    </Show>
  );
};
