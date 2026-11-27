import type { Component } from 'solid-js';
import { createEffect, createSignal, For, Show } from 'solid-js';
import type { ShownConnection } from '../api/connections';
import { connectionIcon, connectionLabel } from '../lib/connections';
import { loadUserConnections } from '../stores/connections';
import { requestOpenExternalLink } from '../stores/externalLink';
import { appSectionLabel } from '../theme/appChrome';
import { t } from '../i18n';

/** "Website · Verified by chat.example" / "... · Not verified". */
function describe(c: ShownConnection): string {
  const status = c.verified ? (c.verified_by ? t('connections.verifiedBy', { domain: c.verified_by }) : t('connections.verified')) : t('connections.notVerified');
  return `${connectionLabel(c.provider)} · ${status}`;
}

/**
 * The "Connections" part of a profile: what the viewer may see of the account's connections
 * (the server decides, and a remote account's home decides for it). `compact` is the popover's
 * row of icons; otherwise a list with names. Links open through the external-link warning.
 * Nothing renders when there is nothing to show.
 */
export const ProfileConnections: Component<{ userId: string | undefined; compact?: boolean; class?: string }> = (props) => {
  const [list, setList] = createSignal<ShownConnection[]>([]);
  let token = 0;
  createEffect(() => {
    const id = props.userId;
    const mine = ++token;
    setList([]);
    if (!id) return;
    void loadUserConnections(id).then((l) => {
      if (mine === token) setList(l);
    });
  });

  const open = (c: ShownConnection) => {
    if (c.url) requestOpenExternalLink(c.url);
  };

  return (
    <Show when={list().length > 0}>
      <div class={props.class} data-profile-connections>
        <p class={`mb-1.5 ${appSectionLabel}`}>{t('connections.title')}</p>
        <Show
          when={!props.compact}
          fallback={
            <div class="flex flex-wrap gap-1.5">
              <For each={list()}>
                {(c) => (
                  <button
                    type="button"
                    class={`flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-xs text-foreground transition-colors ${c.url ? 'hover:bg-muted/60' : 'cursor-default'}`}
                    title={describe(c)}
                    onClick={() => open(c)}
                  >
                    <i class={`${connectionIcon(c.provider)} text-[13px]`} aria-hidden="true" />
                    <span class="truncate">{c.name}</span>
                    <Show when={c.verified}>
                      <i class="fa-solid fa-circle-check text-[11px] text-primary" aria-label={t('connections.verified')} />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          }
        >
          <div class="space-y-1.5">
            <For each={list()}>
              {(c) => (
                <div class="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <i class={`${connectionIcon(c.provider)} w-5 text-center text-base text-muted-foreground`} aria-hidden="true" />
                  <div class="min-w-0 flex-1">
                    <Show when={c.url} fallback={<p class="truncate text-sm font-medium text-foreground">{c.name}</p>}>
                      <button type="button" class="max-w-full truncate text-start text-sm font-medium text-foreground hover:underline" onClick={() => open(c)}>
                        {c.name}
                      </button>
                    </Show>
                    <p class="truncate text-xs text-muted-foreground">{describe(c)}</p>
                  </div>
                  <Show
                    when={c.verified}
                    fallback={<i class="fa-solid fa-triangle-exclamation text-sm text-amber-500" title={t('connections.notVerified')} aria-label={t('connections.notVerified')} />}
                  >
                    <i class="fa-solid fa-circle-check text-sm text-primary" title={describe(c)} aria-label={t('connections.verified')} />
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
};
