import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { settingsRowShell, settingsSectionTitle } from '../settings/settingsChrome';
import { t } from '../../i18n';

/**
 * The admin desk's full-page loading state. The gate asks the server for capabilities before
 * it can decide whether to show the console at all, and on a slow instance that wait is long
 * enough that a blank screen reads as "broken" - so show the shield while we wait.
 */
export const AdminLoadingScreen: Component<{ label?: string; hint?: string }> = (props) => (
  <div
    class="relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden bg-background px-6 text-foreground"
    role="status"
    aria-live="polite"
    data-admin-loading
  >
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-70"
      style={{
        'background-image':
          'radial-gradient(45% 100% at 50% 0%, color-mix(in srgb, var(--color-primary) 18%, transparent), transparent 70%)',
      }}
      aria-hidden="true"
    />
    <div class="relative flex size-20 items-center justify-center">
      <span class="absolute inset-0 rounded-3xl bg-primary/10 ring-1 ring-inset ring-primary/20" aria-hidden="true" />
      <i class="fa-solid fa-shield-halved text-2xl text-primary" aria-hidden="true" />
      <span class="absolute -inset-1.5 animate-spin rounded-[24px] border-2 border-primary/20 border-t-primary" aria-hidden="true" />
    </div>
    <div class="relative text-center">
      <p class="text-sm font-medium">{props.label ?? t('admin.loading')}</p>
      <p class="mt-1 max-w-xs text-xs text-muted-foreground">{props.hint ?? t('admin.loadingHint')}</p>
    </div>
  </div>
);

/** A single shimmering placeholder block. Reuses the media shimmer so reduce-motion stills it. */
const Bar: Component<{ class?: string }> = (props) => <div class={`media-skeleton rounded ${props.class ?? ''}`} aria-hidden="true" />;

export const AdminStatSkeleton: Component<{ count?: number }> = (props) => (
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
    <For each={Array.from({ length: props.count ?? 6 })}>
      {() => (
        <div class="flex items-center gap-3 rounded-2xl border border-border bg-card/40 px-4 py-4">
          <Bar class="size-11 shrink-0 rounded-xl" />
          <div class="min-w-0 flex-1 space-y-2">
            <Bar class="h-5 w-16" />
            <Bar class="h-3 w-24" />
          </div>
        </div>
      )}
    </For>
  </div>
);

export const AdminListSkeleton: Component<{ rows?: number }> = (props) => (
  <div class="space-y-1.5" aria-hidden="true">
    <For each={Array.from({ length: props.rows ?? 5 })}>
      {() => (
        <div class={settingsRowShell}>
          <Bar class="size-10 shrink-0 rounded-lg" />
          <div class="min-w-0 flex-1 space-y-2">
            <Bar class="h-3.5 w-1/3" />
            <Bar class="h-3 w-1/2" />
          </div>
        </div>
      )}
    </For>
  </div>
);

/** The Overview tab's shape while the instance stats are in flight. */
export const AdminOverviewSkeleton: Component = () => {
  const sections = () => [
    { title: t('admin.overview.activity'), count: 3 },
    { title: t('admin.overview.moderation'), count: 3 },
    { title: t('admin.overview.instance'), count: 2 },
  ];
  return (
    <div class="space-y-4">
      <For each={sections()}>
        {(section) => (
          <div>
            <div class={settingsSectionTitle}>{section.title}</div>
            <div class="mt-2">
              <AdminStatSkeleton count={section.count} />
            </div>
          </div>
        )}
      </For>
    </div>
  );
};

/** The user/report/space detail pane's shape while its data loads. */
export const AdminDetailSkeleton: Component<{ banner?: boolean }> = (props) => (
  <div class="space-y-4" aria-hidden="true">
    <Show when={props.banner !== false}>
      <div class="relative overflow-hidden rounded-2xl border border-border bg-card/40">
        <Bar class="h-16 w-full rounded-none" />
        <div class="-mt-8 flex items-start gap-4 px-4 pb-4">
          <Bar class="size-16 shrink-0 rounded-full ring-4 ring-card" />
          <div class="min-w-0 flex-1 space-y-2 pt-9">
            <Bar class="h-4 w-40" />
            <Bar class="h-3 w-24" />
          </div>
        </div>
      </div>
    </Show>
    <div class={`${settingsRowShell} items-center`}>
      <div class="min-w-0 flex-1 space-y-2">
        <Bar class="h-3.5 w-1/4" />
        <Bar class="h-3 w-2/5" />
      </div>
    </div>
    <AdminListSkeleton rows={3} />
  </div>
);
