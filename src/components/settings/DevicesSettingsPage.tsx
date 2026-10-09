import type { Component } from 'solid-js';
import { createSignal, onMount, For, Show } from 'solid-js';
import { listOwnDevices, revokeDevice, type DeviceInfo } from '../../api/devices';
import { E2eeStoreUnusableError, getMachine, getCurrentDeviceId } from '../../lib/e2ee/machine';
import { setRecoveryPrompt } from '../../stores/recoveryPrompt';
import { getOwnFingerprint, getBackupStatus, hasLegacyPinBackup, type BackupStatus } from '../../lib/e2ee';
import {
  createBackupWithPrompt,
  importLegacyWithPrompt,
  regenerateBackupWithPrompt,
  restoreWithPrompt,
} from '../../stores/e2eeBackup';
import { confirmDialog } from '../../stores/confirmDialog';
import { auth } from '../../stores/auth';
import { Button } from '../ui/Button';
import { settingsRowIcon, settingsRowShell, settingsSectionTitle } from './settingsChrome';
import { formatDate, t } from '../../i18n';

const rowShell = settingsRowShell;
const rowIcon = settingsRowIcon;
const sectionTitle = settingsSectionTitle;

function registeredAt(iso: string): string {
  return formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' }) || iso;
}

export const DevicesSettingsPage: Component = () => {
  const [ownFingerprint, setOwnFingerprint] = createSignal('');
  const [devices, setDevices] = createSignal<DeviceInfo[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [revokingId, setRevokingId] = createSignal('');
  const [backup, setBackup] = createSignal<BackupStatus | null>(null);
  const [legacyBackup, setLegacyBackup] = createSignal(false);
  const [backupBusy, setBackupBusy] = createSignal(false);
  const [backupError, setBackupError] = createSignal('');
  const [copied, setCopied] = createSignal(false);
  // The engine could not open this device's store: the safety-number row says so and offers
  // the reset dialog, instead of a dash and a backup that is forever "checking".
  const [storeError, setStoreError] = createSignal<E2eeStoreUnusableError | null>(null);

  const thisDeviceId = () => getCurrentDeviceId();

  async function refresh() {
    const userId = auth.user?.id;
    setLoading(true);
    setError('');
    try {
      const [list, legacy] = await Promise.all([listOwnDevices(), hasLegacyPinBackup().catch(() => false)]);
      setDevices(list);
      setLegacyBackup(legacy);
      if (userId) {
        const machine = await getMachine(userId);
        setOwnFingerprint(await getOwnFingerprint(machine));
        setBackup(await getBackupStatus(userId).catch(() => null));
      }
    } catch (e) {
      console.error('[e2ee] failed to load devices', e);
      if (e instanceof E2eeStoreUnusableError) setStoreError(e);
      else setError(t('settings.devices.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  function openStoreReset() {
    const err = storeError();
    if (err) setRecoveryPrompt('e2eeStoreError', { store: err.storeName, detail: err.detail });
  }

  onMount(refresh);

  /** Run one of the backup flows, then re-read the status so the row reflects the result. */
  async function runBackupAction(action: (userId: string) => Promise<unknown>) {
    const userId = auth.user?.id;
    if (!userId) return;
    setBackupError('');
    setBackupBusy(true);
    try {
      await action(userId);
      setBackup(await getBackupStatus(userId).catch(() => null));
      setLegacyBackup(await hasLegacyPinBackup().catch(() => false));
    } catch (e) {
      console.error('[e2ee] backup action failed', e);
      setBackupError(t('settings.devices.backupFailed'));
    } finally {
      setBackupBusy(false);
    }
  }

  const backupSummary = () => {
    const status = backup();
    if (!status) return loading() ? t('settings.devices.backupChecking') : t('settings.devices.backupUnknown');
    return status.exists ? t('settings.devices.backupOn') : t('settings.devices.backupMissing');
  };

  async function handleRevoke(device: DeviceInfo) {
    if (device.device_id === thisDeviceId()) return;
    const ok = await confirmDialog({
      title: t('settings.devices.revokeTitle'),
      body: t('settings.devices.revokeConfirm'),
      confirmLabel: t('settings.devices.revoke'),
      tone: 'danger',
      icon: 'fa-solid fa-display',
    });
    if (!ok) return;
    setRevokingId(device.device_id);
    try {
      await revokeDevice(device.device_id);
      setDevices((prev) => prev.filter((d) => d.device_id !== device.device_id));
    } catch (e) {
      console.error('[e2ee] failed to revoke device', e);
      setError(t('settings.devices.revokeFailed'));
    } finally {
      setRevokingId('');
    }
  }

  async function copyFingerprint() {
    const fp = ownFingerprint();
    if (!fp) return;
    try {
      await navigator.clipboard.writeText(fp);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div class="max-w-3xl space-y-8">
      <section class="space-y-3">
        <h3 class={sectionTitle}>{t('settings.devices.codeTitle')}</h3>
        <div class={rowShell}>
          <div class={rowIcon}>
            <i class="fa-solid fa-fingerprint text-sm" aria-hidden="true" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[15px] font-semibold text-foreground">{t('settings.devices.safetyNumber')}</p>
            <p class="mt-0.5 break-all font-mono text-xs leading-snug text-muted-foreground" dir="ltr">
              {ownFingerprint() || (loading() ? t('common.loading') : '—')}
            </p>
            <p class="mt-1.5 text-xs leading-snug text-muted-foreground">{t('settings.devices.safetyHint')}</p>
            <Show when={storeError()}>
              <p class="mt-2 text-xs leading-snug text-destructive" role="alert">
                {t('settings.devices.storeUnusable')}
              </p>
            </Show>
          </div>
          <Show
            when={storeError()}
            fallback={
              <Button size="sm" variant="outline" class="shrink-0" disabled={!ownFingerprint()} onClick={copyFingerprint}>
                <i class={`fa-solid ${copied() ? 'fa-check' : 'fa-copy'} text-xs`} aria-hidden="true" />
                {copied() ? t('common.copied') : t('common.copy')}
              </Button>
            }
          >
            <Button size="sm" variant="outline" class="shrink-0" onClick={openStoreReset}>
              {t('e2ee.storeReset')}
            </Button>
          </Show>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={sectionTitle}>{t('settings.devices.backupTitle')}</h3>
        <div class={rowShell}>
          <div class={rowIcon}>
            <i class="fa-solid fa-key text-sm" aria-hidden="true" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[15px] font-semibold text-foreground">{t('settings.devices.backupName')}</p>
            <p class="mt-0.5 text-xs leading-snug text-muted-foreground">{backupSummary()}</p>
            <Show when={backup()?.exists}>
              {/* `n`, not `count`: i18next reads `count` as a plural selector, and these are
                  label-plus-number lines that need no agreement in any locale. */}
              <p class="mt-0.5 text-xs leading-snug text-muted-foreground">
                {t('settings.devices.backupSaved', { n: backup()?.backedUp ?? 0 })}
                <Show when={(backup()?.pending ?? 0) > 0}>
                  {' · '}
                  {t('settings.devices.backupPending', { n: backup()?.pending ?? 0 })}
                </Show>
              </p>
            </Show>
            {/* The device thinks it has uploaded more than the backup holds. Saying so beats
                reporting "On" over a backup that is quietly missing history. */}
            <Show when={backup()?.outOfSync}>
              <p class="mt-1 text-xs leading-snug text-amber-500">{t('settings.devices.backupOutOfSync')}</p>
            </Show>
            {backupError() && <p class="mt-1 text-xs text-destructive">{backupError()}</p>}
          </div>
          <div class="flex shrink-0 flex-wrap justify-end gap-2">
            <Show when={backup()?.exists}>
              {/* Only useful on a device missing history the backup has - so it stays a
                  deliberate action here rather than a prompt the flow raises on its own. */}
              <Button size="sm" variant="ghost" loading={backupBusy()} onClick={() => runBackupAction((id) => restoreWithPrompt(id))}>
                {t('settings.devices.backupRestore')}
              </Button>
            </Show>
            <Button
              size="sm"
              variant="outline"
              loading={backupBusy()}
              onClick={() =>
                runBackupAction(backup()?.exists ? regenerateBackupWithPrompt : createBackupWithPrompt)
              }
            >
              {backup()?.exists ? t('settings.devices.backupReplace') : t('settings.devices.backupSetup')}
            </Button>
          </div>
        </div>

        {/* Only for accounts that predate the current scheme, and only until it is dealt with. */}
        <Show when={legacyBackup()}>
          <div class={rowShell}>
            <div class={rowIcon}>
              <i class="fa-solid fa-clock-rotate-left text-sm" aria-hidden="true" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[15px] font-semibold text-foreground">{t('settings.devices.legacyTitle')}</p>
              <p class="mt-0.5 text-xs leading-snug text-muted-foreground">{t('settings.devices.legacyBody')}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              class="shrink-0"
              loading={backupBusy()}
              onClick={() => runBackupAction((id) => importLegacyWithPrompt(id))}
            >
              {t('settings.devices.legacyImport')}
            </Button>
          </div>
        </Show>
      </section>

      <section class="space-y-3">
        <h3 class={sectionTitle}>{t('settings.devices.devicesTitle')}</h3>
        {error() && <p class="text-xs text-destructive">{error()}</p>}
        <Show when={!loading()} fallback={<p class="text-sm text-muted-foreground">{t('common.loading')}</p>}>
          <div class="space-y-2">
            <For each={devices()}>
              {(d) => {
                const isThisDevice = () => d.device_id === thisDeviceId();
                return (
                  <div class={rowShell}>
                    <div class={rowIcon}>
                      <i class="fa-solid fa-display text-sm" aria-hidden="true" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                        {t('settings.devices.deviceLabel', { id: d.device_id })}
                        <Show when={isThisDevice()}>
                          <span class="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            {t('settings.devices.thisDevice')}
                          </span>
                        </Show>
                      </p>
                      <p class="mt-0.5 text-xs leading-snug text-muted-foreground">
                        {t('settings.devices.statusLine', {
                          status: d.has_keys ? t('settings.devices.active') : t('settings.devices.notSetUp'),
                          date: registeredAt(d.created_at),
                        })}
                      </p>
                    </div>
                    <Show when={!isThisDevice()}>
                      <Button
                        size="sm"
                        variant="outline"
                        class="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        loading={revokingId() === d.device_id}
                        onClick={() => handleRevoke(d)}
                      >
                        {t('settings.devices.revoke')}
                      </Button>
                    </Show>
                  </div>
                );
              }}
            </For>
            <Show when={devices().length === 0}>
              <p class="text-sm text-muted-foreground">{t('settings.devices.none')}</p>
            </Show>
          </div>
        </Show>
      </section>
    </div>
  );
};
