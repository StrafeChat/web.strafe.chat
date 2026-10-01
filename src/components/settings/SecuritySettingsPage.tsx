import type { Component } from 'solid-js';
import { createSignal, onMount, For, Show, Switch, Match } from 'solid-js';
import QRCode from 'qrcode';
import {
  getTwoFactorStatus,
  setupTotp,
  enableTotp,
  disableTotp,
  beginPasskeyRegistration,
  finishPasskeyRegistration,
  deletePasskey,
  regenerateRecoveryCodes,
  type TwoFactorStatus,
} from '../../api/twoFactor';
import { createPasskey, webauthnSupported, isWebauthnCancellation, type PasskeyRegistrationResponse } from '../../lib/webauthn';
import { getMe, sendVerificationEmail } from '../../api/users';
import { instance, loadInstanceInfo } from '../../stores/instance';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { settingsRowShell, settingsRowIcon, settingsSectionTitle } from './settingsChrome';
import { formatDate, t } from '../../i18n';
import { translateCaughtApiError } from '../../lib/formatApiError';

/**
 * Account → Security: TOTP authenticator app, passkeys/security keys, and the recovery
 * codes that back both up. Every mutation here is either a proof (a TOTP code, a passkey
 * ceremony) or gated behind the account password, since this page changes what "prove you
 * are this account" means going forward.
 */

function apiErrorText(err: unknown): string {
  return translateCaughtApiError(err, t).join(' ');
}

const TotpSetupDialog: Component<{ onClose: () => void; onEnabled: (codes: string[] | null) => void }> = (props) => {
  const [secret, setSecret] = createSignal('');
  const [qrDataUrl, setQrDataUrl] = createSignal('');
  const [code, setCode] = createSignal('');
  const [loading, setLoading] = createSignal(true);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  onMount(async () => {
    try {
      const res = await setupTotp();
      setSecret(res.secret);
      setQrDataUrl(await QRCode.toDataURL(res.otpauth_url, { width: 220, margin: 1 }));
    } catch (err) {
      setError(apiErrorText(err));
    } finally {
      setLoading(false);
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError('');
    const c = code().trim();
    if (!c) return;
    setBusy(true);
    try {
      const res = await enableTotp(c);
      props.onEnabled(res.recovery_codes);
    } catch (err) {
      setError(apiErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveDialog
      size="sm"
      onClose={props.onClose}
      closeButton
      dismissible={!busy()}
      title={t('settings.security.totp.setupTitle')}
      description={t('settings.security.totp.setupDescription')}
      icon="fa-solid fa-mobile-screen-button"
    >
      <Show when={!loading()} fallback={<p class="text-sm text-muted-foreground">…</p>}>
        <div class="space-y-4">
          <Show when={qrDataUrl()}>
            <div class="flex justify-center">
              <img src={qrDataUrl()} alt="" class="size-[220px] rounded-lg border border-border bg-white p-2" />
            </div>
          </Show>
          <div class="space-y-1.5">
            <p class="text-xs text-muted-foreground">{t('settings.security.totp.manualEntryHint')}</p>
            <code class="block break-all rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">{secret()}</code>
          </div>
          <form onSubmit={handleSubmit} class="space-y-3">
            <Input
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              label={t('settings.security.totp.confirmLabel')}
              placeholder={t('settings.security.totp.confirmPlaceholder')}
              value={code()}
              onInput={(e) => {
                setError('');
                setCode(e.currentTarget.value);
              }}
              autofocus
            />
            <Show when={error()}>
              <p class="text-xs text-destructive">{error()}</p>
            </Show>
            <Button type="submit" class="w-full" loading={busy()}>
              {t('settings.security.totp.enable')}
            </Button>
          </form>
        </div>
      </Show>
    </ResponsiveDialog>
  );
};

const PasswordPromptDialog: Component<{
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}> = (props) => {
  const [password, setPassword] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError('');
    if (!password()) return;
    setBusy(true);
    try {
      await props.onConfirm(password());
    } catch (err) {
      setError(apiErrorText(err));
      setBusy(false);
    }
  }

  return (
    <ResponsiveDialog
      size="sm"
      onClose={props.onClose}
      closeButton
      dismissible={!busy()}
      title={props.title}
      description={props.description}
      icon="fa-solid fa-lock"
      tone={props.tone ?? 'default'}
    >
      <form onSubmit={handleSubmit} class="space-y-3">
        <Input
          type="password"
          label={t('settings.security.passwordPromptLabel')}
          value={password()}
          onInput={(e) => {
            setError('');
            setPassword(e.currentTarget.value);
          }}
          autocomplete="current-password"
          autofocus
        />
        <Show when={error()}>
          <p class="text-xs text-destructive">{error()}</p>
        </Show>
        <Button type="submit" class="w-full" variant={props.tone === 'danger' ? 'destructive' : 'primary'} loading={busy()}>
          {props.confirmLabel}
        </Button>
      </form>
    </ResponsiveDialog>
  );
};

const RecoveryCodesDialog: Component<{ codes: string[]; onClose: () => void }> = (props) => {
  const [copied, setCopied] = createSignal(false);
  function copyAll() {
    void navigator.clipboard.writeText(props.codes.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <ResponsiveDialog
      size="sm"
      onClose={props.onClose}
      closeButton
      title={t('settings.security.recoveryCodes.dialogTitle')}
      description={t('settings.security.recoveryCodes.dialogDescription')}
      icon="fa-solid fa-key"
    >
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/30 p-3 font-mono text-sm">
          <For each={props.codes}>{(code) => <div class="text-center">{code}</div>}</For>
        </div>
        <Button type="button" variant="outline" class="w-full" onClick={copyAll}>
          <i class={`fa-solid ${copied() ? 'fa-check' : 'fa-copy'} mr-2`} aria-hidden="true" />
          {copied() ? t('settings.security.recoveryCodes.copied') : t('settings.security.recoveryCodes.copyAll')}
        </Button>
        <Button type="button" class="w-full" onClick={props.onClose}>
          {t('settings.security.recoveryCodes.done')}
        </Button>
      </div>
    </ResponsiveDialog>
  );
};

const PasskeyNameDialog: Component<{ onConfirm: (name: string) => void; onClose: () => void }> = (props) => {
  const [name, setName] = createSignal('');
  return (
    <ResponsiveDialog
      size="sm"
      onClose={props.onClose}
      closeButton
      title={t('settings.security.passkeys.nameTitle')}
      description={t('settings.security.passkeys.nameDescription')}
      icon="fa-solid fa-passport"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          props.onConfirm(name().trim() || t('settings.security.passkeys.defaultName'));
        }}
        class="space-y-3"
      >
        <Input
          type="text"
          label={t('settings.security.passkeys.nameLabel')}
          placeholder={t('settings.security.passkeys.defaultName')}
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          autofocus
        />
        <Button type="submit" class="w-full">
          {t('common.confirm')}
        </Button>
      </form>
    </ResponsiveDialog>
  );
};

type ActiveDialog =
  | { kind: 'totpSetup' }
  | { kind: 'disableTotp' }
  | { kind: 'deletePasskey'; credentialId: string; name: string }
  | { kind: 'regenerateCodes' }
  | { kind: 'recoveryCodes'; codes: string[] }
  | { kind: 'passkeyName'; credential: PasskeyRegistrationResponse }
  | null;

export const SecuritySettingsPage: Component = () => {
  const [status, setStatus] = createSignal<TwoFactorStatus | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [dialog, setDialog] = createSignal<ActiveDialog>(null);
  const [passkeyBusy, setPasskeyBusy] = createSignal(false);
  const [passkeyError, setPasskeyError] = createSignal('');

  // The account's address and whether a link sent to it was ever opened. Shown only when
  // the instance can send email at all - without that there is nothing to verify against.
  const [emailInfo, setEmailInfo] = createSignal<{ email: string; verified: boolean } | null>(null);
  const [sendState, setSendState] = createSignal<'idle' | 'sending' | 'sent'>('idle');
  const [sendError, setSendError] = createSignal('');

  async function loadEmail() {
    void loadInstanceInfo();
    try {
      const me = await getMe();
      if (me.email) setEmailInfo({ email: me.email, verified: me.verified_email === true });
    } catch {
      // The 2FA sections below do not depend on this; a failed load just hides the row.
    }
  }
  onMount(() => void loadEmail());

  async function handleSendVerification() {
    setSendError('');
    setSendState('sending');
    try {
      await sendVerificationEmail();
      setSendState('sent');
    } catch (err) {
      setSendError(apiErrorText(err));
      setSendState('idle');
    }
  }

  async function refresh() {
    setLoading(true);
    try {
      setStatus(await getTwoFactorStatus());
      setError('');
    } catch {
      setError(t('settings.security.loadFailed'));
    } finally {
      setLoading(false);
    }
  }
  onMount(() => void refresh());

  async function handleAddPasskey() {
    setPasskeyError('');
    setPasskeyBusy(true);
    try {
      const { publicKey } = await beginPasskeyRegistration();
      const credential = await createPasskey(publicKey);
      setDialog({ kind: 'passkeyName', credential });
    } catch (err) {
      if (!isWebauthnCancellation(err)) setPasskeyError(apiErrorText(err));
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function finishAddPasskey(credential: PasskeyRegistrationResponse, name: string) {
    try {
      const res = await finishPasskeyRegistration(name, credential);
      setDialog(res.recovery_codes ? { kind: 'recoveryCodes', codes: res.recovery_codes } : null);
      await refresh();
    } catch (err) {
      setPasskeyError(apiErrorText(err));
      setDialog(null);
    }
  }

  return (
    <div class="space-y-6">
      <Show when={instance.email.enabled && emailInfo()}>
        {(info) => (
          <section class="space-y-2">
            <h3 class={settingsSectionTitle}>{t('settings.security.email.sectionTitle')}</h3>
            <div class={settingsRowShell}>
              <div class={settingsRowIcon}>
                <i class="fa-solid fa-envelope" aria-hidden="true" />
              </div>
              <div class="min-w-0 flex-1">
                {/* Wrap rather than truncate: the address is the one thing this row is about,
                    and beside the badge and button a narrow panel would cut it to "opt-17…". */}
                <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
                  <span class="break-all">{info().email}</span>
                  <span
                    class={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      info().verified ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'
                    }`}
                  >
                    {info().verified ? t('settings.security.email.verified') : t('settings.security.email.unverified')}
                  </span>
                </p>
                <p class={`text-xs ${sendError() ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {sendError() ||
                    (info().verified
                      ? t('settings.security.email.verifiedHint')
                      : sendState() === 'sent'
                        ? t('settings.security.email.sent')
                        : t('settings.security.email.unverifiedHint'))}
                </p>
              </div>
              <Show when={!info().verified}>
                <Button
                  size="sm"
                  variant="outline"
                  loading={sendState() === 'sending'}
                  disabled={sendState() === 'sent'}
                  onClick={() => void handleSendVerification()}
                >
                  {t('settings.security.email.send')}
                </Button>
              </Show>
            </div>
          </section>
        )}
      </Show>
      <Show when={error()}>
        <p class="px-0.5 text-sm text-destructive">{error()}</p>
      </Show>
      <Show when={!loading() && status()} fallback={<p class="px-0.5 text-sm text-muted-foreground">…</p>}>
        {(s) => (
          <>
            <section class="space-y-2">
              <h3 class={settingsSectionTitle}>{t('settings.security.totp.sectionTitle')}</h3>
              <div class={settingsRowShell}>
                <div class={settingsRowIcon}>
                  <i class="fa-solid fa-mobile-screen-button" aria-hidden="true" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-foreground">{t('settings.security.totp.rowTitle')}</p>
                  <p class="text-xs text-muted-foreground">
                    {s().totp_enabled ? t('settings.security.totp.enabledHint') : t('settings.security.totp.disabledHint')}
                  </p>
                </div>
                <Show
                  when={s().totp_enabled}
                  fallback={
                    <Button size="sm" onClick={() => setDialog({ kind: 'totpSetup' })}>
                      {t('settings.security.totp.enable')}
                    </Button>
                  }
                >
                  <Button size="sm" variant="destructive" onClick={() => setDialog({ kind: 'disableTotp' })}>
                    {t('settings.security.totp.disable')}
                  </Button>
                </Show>
              </div>
            </section>

            <section class="space-y-2">
              <div class="flex items-center justify-between px-0.5">
                <h3 class={settingsSectionTitle}>{t('settings.security.passkeys.sectionTitle')}</h3>
                <Show when={webauthnSupported()}>
                  <Button size="sm" variant="outline" loading={passkeyBusy()} onClick={() => void handleAddPasskey()}>
                    <i class="fa-solid fa-plus mr-1.5 text-xs" aria-hidden="true" />
                    {t('settings.security.passkeys.add')}
                  </Button>
                </Show>
              </div>
              <Show when={passkeyError()}>
                <p class="px-0.5 text-xs text-destructive">{passkeyError()}</p>
              </Show>
              <Show
                when={s().webauthn_credentials.length > 0}
                fallback={<EmptyState icon="fa-solid fa-passport" title={t('settings.security.passkeys.empty')} />}
              >
                <div class="space-y-2">
                  <For each={s().webauthn_credentials}>
                    {(cred) => (
                      <div class={settingsRowShell}>
                        <div class={settingsRowIcon}>
                          <i class="fa-solid fa-passport" aria-hidden="true" />
                        </div>
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium text-foreground">{cred.name}</p>
                          <p class="text-xs text-muted-foreground">
                            {t('settings.security.passkeys.added', { when: formatDate(cred.created_at, { dateStyle: 'medium' }) })}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDialog({ kind: 'deletePasskey', credentialId: cred.id, name: cred.name })}
                        >
                          {t('settings.security.passkeys.remove')}
                        </Button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </section>

            <Show when={s().totp_enabled || s().webauthn_credentials.length > 0}>
              <section class="space-y-2">
                <h3 class={settingsSectionTitle}>{t('settings.security.recoveryCodes.sectionTitle')}</h3>
                <div class={settingsRowShell}>
                  <div class={settingsRowIcon}>
                    <i class="fa-solid fa-key" aria-hidden="true" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-foreground">{t('settings.security.recoveryCodes.rowTitle')}</p>
                    <p class="text-xs text-muted-foreground">
                      {t('settings.security.recoveryCodes.remaining', { count: String(s().recovery_codes_remaining) })}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'regenerateCodes' })}>
                    {t('settings.security.recoveryCodes.regenerate')}
                  </Button>
                </div>
              </section>
            </Show>
          </>
        )}
      </Show>

      <Switch>
        <Match when={dialog()?.kind === 'totpSetup'}>
          <TotpSetupDialog
            onClose={() => setDialog(null)}
            onEnabled={(codes) => {
              void refresh();
              setDialog(codes ? { kind: 'recoveryCodes', codes } : null);
            }}
          />
        </Match>
        <Match when={dialog()?.kind === 'disableTotp'}>
          <PasswordPromptDialog
            title={t('settings.security.totp.disableTitle')}
            description={t('settings.security.totp.disableDescription')}
            confirmLabel={t('settings.security.totp.disable')}
            tone="danger"
            onConfirm={async (password) => {
              await disableTotp(password);
              setDialog(null);
              await refresh();
            }}
            onClose={() => setDialog(null)}
          />
        </Match>
        <Match when={dialog()?.kind === 'deletePasskey'}>
          {(() => {
            const d = dialog() as { kind: 'deletePasskey'; credentialId: string; name: string };
            return (
              <PasswordPromptDialog
                title={t('settings.security.passkeys.removeTitle')}
                description={t('settings.security.passkeys.removeDescription', { name: d.name })}
                confirmLabel={t('settings.security.passkeys.remove')}
                tone="danger"
                onConfirm={async (password) => {
                  await deletePasskey(d.credentialId, password);
                  setDialog(null);
                  await refresh();
                }}
                onClose={() => setDialog(null)}
              />
            );
          })()}
        </Match>
        <Match when={dialog()?.kind === 'regenerateCodes'}>
          <PasswordPromptDialog
            title={t('settings.security.recoveryCodes.regenerateTitle')}
            description={t('settings.security.recoveryCodes.regenerateDescription')}
            confirmLabel={t('settings.security.recoveryCodes.regenerate')}
            onConfirm={async (password) => {
              const res = await regenerateRecoveryCodes(password);
              setDialog({ kind: 'recoveryCodes', codes: res.recovery_codes });
              await refresh();
            }}
            onClose={() => setDialog(null)}
          />
        </Match>
        <Match when={dialog()?.kind === 'recoveryCodes'}>
          <RecoveryCodesDialog codes={(dialog() as { kind: 'recoveryCodes'; codes: string[] }).codes} onClose={() => setDialog(null)} />
        </Match>
        <Match when={dialog()?.kind === 'passkeyName'}>
          {(() => {
            const d = dialog() as { kind: 'passkeyName'; credential: PasskeyRegistrationResponse };
            return (
              <PasskeyNameDialog onConfirm={(name) => void finishAddPasskey(d.credential, name)} onClose={() => setDialog(null)} />
            );
          })()}
        </Match>
      </Switch>
    </div>
  );
};
