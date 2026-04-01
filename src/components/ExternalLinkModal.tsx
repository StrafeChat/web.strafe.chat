import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import {
  externalLink,
  getDomainFromUrl,
  closeExternalLinkModal,
  confirmExternalLink,
} from '../stores/externalLink';
import { ResponsiveDialog } from './ui/ResponsiveDialog';

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
      <Portal mount={document.body}>
        <ResponsiveDialog
          size="md"
          zClass="z-[220]"
          ariaLabelledby="external-link-title"
          onBackdropClick={handleClose}
        >
          <div class="flex items-start justify-between gap-4 p-4 pb-0">
            <h2
              id="external-link-title"
              class="text-lg font-semibold text-foreground"
            >
              External Link Warning
            </h2>
            <button
              type="button"
              class="size-8 shrink-0 rounded text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center transition-colors"
              onClick={handleClose}
              aria-label="Close"
            >
              <i class="fa-solid fa-xmark text-lg" />
            </button>
          </div>
          <div class="p-4 pt-3 flex flex-col items-center text-center">
            <div class="size-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-3">
              <i class="fa-solid fa-triangle-exclamation text-amber-500 text-xl" />
            </div>
            <p class="font-semibold text-foreground">You are about to leave Strafe</p>
            <p class="text-sm text-muted-foreground mt-0.5">
              External links can be dangerous. Please be careful.
            </p>
          </div>
          <div class="px-4 pb-3">
            <p class="text-xs font-medium text-muted-foreground mb-1.5">Destination URL:</p>
            <div class="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground break-all font-mono">
              {url()}
            </div>
          </div>
          <Show when={domain()}>
            <label class="flex items-center gap-2 px-4 pb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={trustDomain()}
                onInput={(e) => setTrustDomain((e.target as HTMLInputElement).checked)}
                class="rounded border-input"
              />
              <span class="text-sm text-muted-foreground">
                Always trust <strong class="text-foreground">{domain()}</strong> — skip this warning next time
              </span>
            </label>
          </Show>
          <div class="flex items-center justify-end gap-2 px-4 pb-4">
            <button
              type="button"
              class="px-4 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors inline-flex items-center gap-2"
              onClick={handleVisit}
            >
              Visit Site
              <i class="fa-solid fa-arrow-up-right-from-square text-xs" />
            </button>
          </div>
        </ResponsiveDialog>
      </Portal>
    </Show>
  );
};
