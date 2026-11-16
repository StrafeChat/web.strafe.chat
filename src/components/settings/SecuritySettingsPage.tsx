import type { Component } from 'solid-js';
import { createSignal, onCleanup, onMount, For, Show, Switch, Match } from 'solid-js';
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
import { sendVerificationEmail } from '../../api/users';
import {
  accountEmail,
  cancelPendingEmailChange,
  confirmPendingEmailChange,
  currentAccountEmail,
  loadAccountEmail,
  resendPendingEmailChange,
} from '../../stores/accountEmail';
import { parseEmailChangeToken } from '../../lib/emailChange';
import { instance, loadInstanceInfo } from '../../stores/instance';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { PasswordPromptDialog } from './PasswordPromptDialog';
import { ChangeEmailDialog } from './ChangeEmailDialog';
import { settingsRowShell, settingsRowIcon, settingsSectionTitle } from './settingsChrome';
import { formatDate, t } from '../../i18n';
import { translateCaughtApiError } from '../../lib/formatApiError';
import { isDesktop } from '../../desktop/env';

/**
 * Account → Security: the account's email address (and changing it), TOTP authenticator
 * app, passkeys/security keys, and the recovery codes that back both up. Every mutation here is either a proof (a TOTP code, a passkey
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

/** "I have the link": the confirmation link pasted in, for a person whose link opened in
 * another browser (or the desktop app's system browser). */
const PasteEmailLinkDialog: Component<{ pendingEmail: string; onConfirmed: () => void; onClose: () => void }> = (props) => {
  const [value, setValue] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError('');
    const token = parseEmailChangeToken(value());
    if (!token) {
      setError(t('settings.security.email.paste.invalid'));
      return;
    }
    setBusy(true);
    try {
      await confirmPendingEmailChange(token);
      setBusy(false);
      props.onConfirmed();
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
      title={t('settings.security.email.paste.title')}
      description={t('settings.security.email.paste.description', { email: props.pendingEmail })}
      icon="fa-solid fa-link"
    >
      <form onSubmit={handleSubmit} class="space-y-3" novalidate>
        <Input
          type="url"
          autocomplete="off"
          label={t('settings.security.email.paste.label')}
          placeholder={t('settings.security.email.paste.placeholder')}
          value={value()}
          onInput={(e) => {
            setError('');
            setValue(e.currentTarget.value);
          }}
          disabled={busy()}
          autofocus
        />
        <Show when={error()}>
          <p class="text-xs text-destructive">{error()}</p>
        </Show>
        <Button type="submit" class="w-full" loading={busy()}>
          {t('settings.security.email.paste.submit')}
        </Button>
      </form>
    </ResponsiveDialog>
  );
};

/** Status lines for the email rows, after an action on this page. */
type EmailNotice = '' | 'changed' | 'cancelled';

/** Resend shares the server's one-a-minute cooldown with the request itself. */
const RESEND_LOCK_MS = 60_000;

type ActiveDialog =
  | { kind: 'totpSetup' }
  | { kind: 'disableTotp' }
  | { kind: 'deletePasskey'; credentialId: string; name: string }
  | { kind: 'regenerateCodes' }
  | { kind: 'recoveryCodes'; codes: string[] }
  | { kind: 'passkeyName'; credential: PasskeyRegistrationResponse }
  | { kind: 'changeEmail' }
  | { kind: 'changeEmailSent'; email: string }
  | { kind: 'pasteEmailLink' }
  | null;

export const SecuritySettingsPage: Component = () => {
  const [status, setStatus] = createSignal<TwoFactorStatus | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [dialog, setDialog] = createSignal<ActiveDialog>(null);
  const [passkeyBusy, setPasskeyBusy] = createSignal(false);
  const [passkeyError, setPasskeyError] = createSignal('');

  // The account's address, whether a link sent to it was ever opened, and any change
  // waiting for confirmation (stores/accountEmail; live through USER_EMAIL_UPDATE). The row
  // shows whether or not the instance can send email - only verifying needs that.
  const email = () => currentAccountEmail();
  const [sendState, setSendState] = createSignal<'idle' | 'sending' | 'sent'>('idle');
  const [sendError, setSendError] = createSignal('');
  const [notice, setNotice] = createSignal<EmailNotice>('');
  const [resendBusy, setResendBusy] = createSignal(false);
  const [resendLocked, setResendLocked] = createSignal(false);
  const [resendNotice, setResendNotice] = createSignal('');
  const [resendError, setResendError] = createSignal(false);
  const [cancelBusy, setCancelBusy] = createSignal(false);
  let resendTimer: number | undefined;
  onCleanup(() => window.clearTimeout(resendTimer));

  function lockResend() {
    window.clearTimeout(resendTimer);
    setResendLocked(true);
    resendTimer = window.setTimeout(() => setResendLocked(false), RESEND_LOCK_MS);
  }

  onMount(() => {
    void loadInstanceInfo();
    void loadAccountEmail();
  });

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

  async function handleResend() {
    setResendNotice('');
    setResendError(false);
    setResendBusy(true);
    try {
      await resendPendingEmailChange();
      lockResend();
      setResendNotice(t('settings.security.email.pending.resent'));
    } catch (err) {
      setResendError(true);
      setResendNotice(apiErrorText(err));
    } finally {
      setResendBusy(false);
    }
  }

  async function handleCancelChange() {
    setResendNotice('');
    setResendError(false);
    setCancelBusy(true);
    try {
      await cancelPendingEmailChange();
      setNotice('cancelled');
    } catch (err) {
      setResendError(true);
      setResendNotice(apiErrorText(err));
    } finally {
      setCancelBusy(false);
    }
  }

  /** The address moved (a direct change, or a pasted link): the old send state no longer
   * describes it. */
  function emailChanged() {
    setSendState('idle');
    setSendError('');
    setResendNotice('');
    setResendError(false);
    setNotice('changed');
  }

  function emailHint(verified: boolean): string {
    if (notice() === 'changed') return t('settings.security.email.change.changed');
    if (notice() === 'cancelled') return t('settings.security.email.pending.cancelled');
    if (!instance.email.enabled) return t('settings.security.email.noMailHint');
    if (verified) return t('settings.security.email.verifiedHint');
    return sendState() === 'sent' ? t('settings.security.email.sent') : t('settings.security.email.unverifiedHint');
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
      <Show when={email()?.email.includes('@') ? email() : null}>
        {(info) => (
          <section class="space-y-2">
            <h3 class={settingsSectionTitle}>{t('settings.security.email.sectionTitle')}</h3>
            <div class={`${settingsRowShell} flex-wrap`}>
              <div class={settingsRowIcon}>
                <i class="fa-solid fa-envelope" aria-hidden="true" />
              </div>
              <div class="min-w-0 flex-1 basis-48">
                {/* Wrap rather than truncate: the address is the one thing this row is about,
                    and beside the badge and button a narrow panel would cut it to "opt-17…". */}
                <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
                  <span class="break-all">{info().email}</span>
                  {/* Verification means something only where the instance can send the link. */}
                  <Show when={instance.email.enabled}>
                    <span
                      class={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        info().verified_email ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'
                      }`}
                    >
                      {info().verified_email ? t('settings.security.email.verified') : t('settings.security.email.unverified')}
                    </span>
                  </Show>
                </p>
                <p class={`text-xs ${sendError() ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {sendError() || emailHint(info().verified_email)}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <Show when={instance.email.enabled && !info().verified_email && !info().pending}>
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
                <Show when={accountEmail.supported}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading()}
                    onClick={() => {
                      setNotice('');
                      setDialog({ kind: 'changeEmail' });
                    }}
                  >
                    {t('settings.security.email.change.button')}
                  </Button>
                </Show>
              </div>
            </div>
            <Show when={info().pending}>
              {(pending) => (
                <div class={`${settingsRowShell} flex-wrap`}>
                  <div class={settingsRowIcon}>
                    <i class="fa-solid fa-clock" aria-hidden="true" />
                  </div>
                  <div class="min-w-0 flex-1 basis-48">
                    <p class="text-sm font-medium text-foreground">{t('settings.security.email.pending.title')}</p>
                    <p class="break-words text-xs text-muted-foreground">
                      {t('settings.security.email.pending.body', {
                        email: pending().email,
                        time: formatDate(pending().expires_at, { timeStyle: 'short' }),
                      })}
                    </p>
                    <Show when={resendNotice()}>
                      <p class={`text-xs ${resendError() ? 'text-destructive' : 'text-muted-foreground'}`}>{resendNotice()}</p>
                    </Show>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={resendBusy()}
                      disabled={resendLocked() || cancelBusy()}
                      onClick={() => void handleResend()}
                    >
                      {t('settings.security.email.pending.resend')}
                    </Button>
                    <Button size="sm" variant="outline" disabled={cancelBusy()} onClick={() => setDialog({ kind: 'pasteEmailLink' })}>
                      {t('settings.security.email.pending.paste')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      class="text-destructive! hover:bg-destructive/10"
                      loading={cancelBusy()}
                      onClick={() => void handleCancelChange()}
                    >
                      {t('settings.security.email.pending.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </Show>
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
                {/* Not in the desktop app: a passkey is bound to the instance's domain, and the
                    app's page is not served from it, so creating one always fails there (sign-in
                    hides passkeys on desktop for the same reason). Listing and removing still work. */}
                <Show when={webauthnSupported() && !isDesktop()}>
                  <Button size="sm" variant="outline" loading={passkeyBusy()} onClick={() => void handleAddPasskey()}>
                    <i class="fa-solid fa-plus mr-1.5 text-xs" aria-hidden="true" />
                    {t('settings.security.passkeys.add')}
                  </Button>
                </Show>
              </div>
              <Show when={isDesktop()}>
                <p class="px-0.5 text-xs text-muted-foreground">{t('settings.security.passkeys.desktopUnavailable')}</p>
              </Show>
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
                      {/* A number, not a string: i18next only picks a plural form for a numeric count. */}
                      {t('settings.security.recoveryCodes.remaining', { count: s().recovery_codes_remaining })}
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
        <Match when={dialog()?.kind === 'changeEmail'}>
          <ChangeEmailDialog
            currentEmail={email()?.email ?? ''}
            mailEnabled={instance.email.enabled}
            totpEnabled={status()?.totp_enabled === true}
            hasPasskeys={(status()?.webauthn_credentials.length ?? 0) > 0}
            onDone={(state, sent) => {
              if (sent && state.pending) {
                // The request was a 202, which starts the same one-minute cooldown as a resend.
                lockResend();
                setResendNotice('');
                setResendError(false);
                setDialog({ kind: 'changeEmailSent', email: state.pending.email });
              } else {
                emailChanged();
                setDialog(null);
              }
            }}
            onClose={() => setDialog(null)}
          />
        </Match>
        <Match when={dialog()?.kind === 'changeEmailSent'}>
          <ResponsiveDialog
            size="sm"
            onClose={() => setDialog(null)}
            closeButton
            title={t('settings.security.email.change.sentTitle')}
            icon="fa-solid fa-envelope-circle-check"
          >
            <div class="space-y-4">
              <p class="break-words text-sm text-muted-foreground">
                {t('settings.security.email.change.sentBody', {
                  email: (dialog() as { kind: 'changeEmailSent'; email: string }).email,
                })}
              </p>
              <Button type="button" class="w-full" onClick={() => setDialog(null)}>
                {t('settings.security.email.change.done')}
              </Button>
            </div>
          </ResponsiveDialog>
        </Match>
        <Match when={dialog()?.kind === 'pasteEmailLink'}>
          <PasteEmailLinkDialog
            pendingEmail={email()?.pending?.email ?? ''}
            onConfirmed={() => {
              emailChanged();
              setDialog(null);
            }}
            onClose={() => setDialog(null)}
          />
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
