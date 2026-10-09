import type { Component } from 'solid-js';
import { createResource, createSignal, For, Show } from 'solid-js';
import {
  listDiscoverQueue,
  reviewDiscoverListing,
  type DiscoverEntry,
  type DiscoverStatus,
} from '../../api/discover';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { Textarea } from '../ui/Textarea';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { AdminFilterTabs } from './AdminTabs';
import { AdminListSkeleton } from './AdminLoading';
import { confirmDialog } from '../../stores/confirmDialog';
import { settingsRowShell } from '../settings/settingsChrome';
import { appDialogActions, zLayer } from '../../theme/appChrome';
import { formatDate, t } from '../../i18n';

const when = (iso?: string) => (iso ? formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' }) || iso : '');
const nameOf = (e: DiscoverEntry) => e.space?.name ?? e.bot?.name ?? e.id;
const avatarOf = (e: DiscoverEntry) => e.space?.icon ?? e.bot?.bot?.avatar ?? e.bot?.icon;

/**
 * Admin → Discover: the listings waiting for review, the ones on the page, and the ones
 * declined. Approving puts a space or bot on Discover; declining (or removing an approved
 * one) takes a note the applicant sees in their settings.
 */
export const DiscoverQueue: Component<{ onOpenUser: (id: string) => void; onOpenSpace: (id: string) => void }> = (props) => {
  const [status, setStatus] = createSignal<DiscoverStatus>('pending');
  const [rows, { refetch }] = createResource(status, (s) => listDiscoverQueue(s));
  const [declining, setDeclining] = createSignal<DiscoverEntry | null>(null);
  const [note, setNote] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  async function approve(e: DiscoverEntry) {
    const ok = await confirmDialog({
      title: t('admin.discover.approveTitle', { name: nameOf(e) }),
      body: t('admin.discover.approveBody'),
      confirmLabel: t('admin.discover.approve'),
    });
    if (!ok) return;
    setError('');
    try {
      await reviewDiscoverListing(e.kind, e.id, 'approve');
    } catch {
      setError(t('admin.actionFailed'));
    }
    void refetch();
  }

  async function decline() {
    const e = declining();
    if (!e) return;
    setBusy(true);
    setError('');
    try {
      await reviewDiscoverListing(e.kind, e.id, 'deny', note().trim());
      setDeclining(null);
      setNote('');
      void refetch();
    } catch {
      setError(t('admin.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="space-y-4" data-admin-discover>
      <AdminFilterTabs<DiscoverStatus>
        value={status()}
        onChange={setStatus}
        items={[
          { id: 'pending', icon: 'fa-hourglass-half', label: t('admin.discover.pending') },
          { id: 'approved', icon: 'fa-circle-check', label: t('admin.discover.approved') },
          { id: 'denied', icon: 'fa-circle-xmark', label: t('admin.discover.denied') },
        ]}
      />
      <Show when={error()}>
        <p class="text-sm text-destructive" role="alert">{error()}</p>
      </Show>
      <Show when={rows()} fallback={<AdminListSkeleton rows={5} />}>
        {(list) => (
          <Show when={list().length > 0} fallback={<EmptyState icon="fa-compass" title={t('admin.discover.empty')} size="inline" />}>
            <div class="space-y-1.5">
              <For each={list()}>
                {(e, i) => (
                  <div
                    style={{ 'animation-delay': `${Math.min(i() * 30, 300)}ms` }}
                    class={`admin-row-in ${settingsRowShell}`}
                    data-discover-row={`${e.kind}:${e.id}`}
                  >
                    <MessageAvatar name={nameOf(e)} avatar={avatarOf(e)} class="size-10 text-sm" />
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <Show when={e.kind === 'space'} fallback={<span class="truncate">{nameOf(e)}</span>}>
                          <button type="button" class="truncate hover:underline" onClick={() => props.onOpenSpace(e.id)}>
                            {nameOf(e)}
                          </button>
                        </Show>
                        <span class="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {e.kind === 'space' ? t('admin.discover.kindSpace') : t('admin.discover.kindBot')}
                        </span>
                        <Show when={e.space}>{(s) => <span class="text-xs font-normal text-muted-foreground">{t('discover.members', { count: s().member_count })}</span>}</Show>
                      </div>
                      <Show when={e.tagline}>
                        <div class="truncate text-sm text-muted-foreground">{e.tagline}</div>
                      </Show>
                      <div class="truncate text-xs text-muted-foreground">
                        <Show when={e.requested_by_user}>
                          {(u) => (
                            <>
                              {t('admin.discover.requestedBy')}{' '}
                              <button type="button" class="hover:underline" onClick={() => props.onOpenUser(u().id)}>
                                @{u().username}
                              </button>
                              {' · '}
                            </>
                          )}
                        </Show>
                        {when(e.requested_at)}
                        <Show when={e.tags.length > 0}> · {e.tags.join(', ')}</Show>
                        <Show when={e.status === 'denied' && e.note}> · {e.note}</Show>
                      </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-1.5">
                      <Show when={e.status !== 'approved'}>
                        <Button size="sm" onClick={() => void approve(e)}>{t('admin.discover.approve')}</Button>
                      </Show>
                      <Show when={e.status === 'pending'}>
                        <Button size="sm" variant="outline" onClick={() => { setNote(''); setDeclining(e); }}>{t('admin.discover.deny')}</Button>
                      </Show>
                      <Show when={e.status === 'approved'}>
                        <Button size="sm" variant="outline" onClick={() => { setNote(''); setDeclining(e); }}>{t('admin.discover.remove')}</Button>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        )}
      </Show>

      <Show when={declining()}>
        {(e) => (
          <ResponsiveDialog
            size="sm"
            zClass={zLayer.modalStacked}
            onClose={() => setDeclining(null)}
            dismissible={!busy()}
            title={e().status === 'approved' ? t('admin.discover.removeTitle', { name: nameOf(e()) }) : t('admin.discover.denyTitle', { name: nameOf(e()) })}
            icon="fa-solid fa-compass"
          >
            <div class="space-y-3">
              <Textarea
                label={t('admin.discover.noteLabel')}
                rows={3}
                value={note()}
                maxLength={500}
                placeholder={t('admin.discover.notePlaceholder')}
                onInput={(ev) => setNote(ev.currentTarget.value)}
              />
              <div class={appDialogActions}>
                <Button variant="ghost" disabled={busy()} onClick={() => setDeclining(null)}>{t('common.cancel')}</Button>
                <Button variant="destructive" loading={busy()} onClick={() => void decline()}>
                  {e().status === 'approved' ? t('admin.discover.remove') : t('admin.discover.deny')}
                </Button>
              </div>
            </div>
          </ResponsiveDialog>
        )}
      </Show>
    </div>
  );
};
