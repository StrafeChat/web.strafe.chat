import type { Component } from 'solid-js';
import { createSignal, createEffect, For, Show } from 'solid-js';
import { auth } from '../stores/auth';
import { closeSafetyNumberModal, safetyNumberModal } from '../stores/safetyNumberModal';
import { getMachine } from '../lib/e2ee/machine';
import {
  getOwnFingerprint,
  getPeerDevices,
  markDeviceVerified,
  clearDeviceVerification,
  type DeviceSafetyInfo,
} from '../lib/e2ee';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { Button } from './ui/Button';
import { appSectionLabel, zLayer } from '../theme/appChrome';
import { t } from '../i18n';

export const SafetyNumberModal: Component = () => {
  const [ownFingerprint, setOwnFingerprint] = createSignal('');
  const [devices, setDevices] = createSignal<DeviceSafetyInfo[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [busyDeviceId, setBusyDeviceId] = createSignal('');

  const subject = () => safetyNumberModal.subject;

  async function refresh() {
    const currentUserId = auth.user?.id;
    const peerId = subject()?.userId;
    if (!currentUserId || !peerId) return;
    setLoading(true);
    setError('');
    try {
      const machine = await getMachine(currentUserId);
      const [own, peerDevices] = await Promise.all([
        getOwnFingerprint(machine),
        getPeerDevices(machine, peerId),
      ]);
      setOwnFingerprint(own);
      setDevices(peerDevices);
    } catch (e) {
      console.error('[e2ee] failed to load safety numbers', e);
      setError(t('safety.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  createEffect(() => {
    if (safetyNumberModal.open) void refresh();
  });

  async function toggleVerified(device: DeviceSafetyInfo) {
    const currentUserId = auth.user?.id;
    const peerId = subject()?.userId;
    if (!currentUserId || !peerId) return;
    setBusyDeviceId(device.deviceId);
    try {
      const machine = await getMachine(currentUserId);
      if (device.verified) {
        await clearDeviceVerification(machine, peerId, device.deviceId);
      } else {
        await markDeviceVerified(machine, peerId, device.deviceId);
      }
      await refresh();
    } catch (e) {
      console.error('[e2ee] failed to update device trust', e);
    } finally {
      setBusyDeviceId('');
    }
  }

  return (
    <Show when={safetyNumberModal.open && subject()}>
      <ResponsiveDialog
        size="md"
        zClass={zLayer.modalStacked}
        onClose={closeSafetyNumberModal}
        title={t('safety.title')}
        description={t('safety.body', { name: subject()?.displayName ?? '' })}
        icon="fa-solid fa-shield-halved"
        closeButton
      >
        <div class="space-y-5">
          <Show when={loading()}>
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <span class="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              {t('common.loading')}
            </div>
          </Show>
          <Show when={error()}>
            <p class="text-sm text-destructive">{error()}</p>
          </Show>

          <Show when={!loading() && !error()}>
            <div>
              <p class={`mb-1.5 ${appSectionLabel}`}>{t('safety.yourCode')}</p>
              <p class="break-all rounded-lg border border-border bg-muted/40 px-3 py-2.5 font-mono text-sm tracking-wide text-foreground" dir="ltr">
                {ownFingerprint() || '—'}
              </p>
            </div>

            <div>
              <p class={`mb-1.5 ${appSectionLabel}`}>{t('safety.theirDevices', { name: subject()?.displayName ?? '' })}</p>
              <Show when={devices().length === 0}>
                <p class="text-sm text-muted-foreground">{t('settings.devices.none')}</p>
              </Show>
              <div class="space-y-2">
                <For each={devices()}>
                  {(d) => (
                    <div class="rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-medium text-muted-foreground">{t('settings.devices.deviceLabel', { id: d.deviceId })}</span>
                        <Show when={d.verified}>
                          <span class="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            <i class="fa-solid fa-circle-check" aria-hidden="true" /> {t('safety.verified')}
                          </span>
                        </Show>
                      </div>
                      <p class="mt-1 break-all font-mono text-sm tracking-wide text-foreground" dir="ltr">{d.fingerprint || '—'}</p>
                      <div class="mt-2">
                        <Button
                          size="sm"
                          variant={d.verified ? 'outline' : 'primary'}
                          class="h-8 text-xs"
                          loading={busyDeviceId() === d.deviceId}
                          onClick={() => void toggleVerified(d)}
                        >
                          {d.verified ? t('safety.clearVerification') : t('safety.markVerified')}
                        </Button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </ResponsiveDialog>
    </Show>
  );
};
