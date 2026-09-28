import type { Component } from 'solid-js';
import { createSignal, Match, Show, Switch } from 'solid-js';
import {
  cancelRecoveryPrompt,
  recoveryPrompt,
  submitRecoveryPrompt,
} from '../stores/recoveryPrompt';
import { formatRecoveryCode, isWellFormedRecoveryCode, normalizeRecoveryCode, RECOVERY_CODE_LENGTH } from '../lib/e2ee/recoveryCode';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { appDialogActions, zLayer } from '../theme/appChrome';
import { t } from '../i18n';

/**
 * The three key-backup dialogs, over one frame: show a new recovery code, ask for one, or ask
 * for the old PIN while migrating an account that predates the current scheme.
 *
 * Both "ask" views offer a way out that isn't the answer - Later, and "I don't have it" - so a
 * user who can't answer is never stuck in a dialog. The flow in stores/e2eeBackup treats those
 * as different outcomes; see RecoveryCancelReason.
 */

const codeBlock =
  'select-all rounded-lg border border-border bg-muted/40 px-4 py-3 text-center font-mono text-base leading-relaxed tracking-[0.18em] break-all';

const ShowCodeView: Component<{ code: string }> = (props) => {
  const [copied, setCopied] = createSignal(false);
  const [saved, setSaved] = createSignal(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the code is selectable, and Download still works.
    }
  }

  function download() {
    // A Blob URL rather than a data: URL so the filename is honoured everywhere. The anchor
    // has to be in the document for Firefox to act on a synthetic click, and the URL must
    // outlive that click - revoking it in the same tick cancels the download in some browsers.
    const blob = new Blob([`${t('recovery.codeFileHeading')}\n\n${props.code}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'strafe-recovery-code.txt';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 0);
    setSaved(true);
  }

  return (
    <div class="space-y-4">
      <p class={codeBlock} dir="ltr">
        {props.code}
      </p>
      <div class="flex gap-2">
        <Button type="button" variant="outline" class="flex-1" onClick={copy}>
          <i class={`fa-solid ${copied() ? 'fa-check' : 'fa-copy'} text-xs`} aria-hidden="true" />
          {copied() ? t('common.copied') : t('common.copy')}
        </Button>
        <Button type="button" variant="outline" class="flex-1" onClick={download}>
          <i class="fa-solid fa-download text-xs" aria-hidden="true" />
          {t('recovery.download')}
        </Button>
      </div>
      <p class="text-xs leading-snug text-muted-foreground">{t('recovery.codeWarning')}</p>
      <label class="flex cursor-pointer items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          class="mt-0.5 size-4 accent-primary"
          checked={saved()}
          onChange={(e) => setSaved((e.target as HTMLInputElement).checked)}
        />
        <span>{t('recovery.savedConfirm')}</span>
      </label>
      <div class={appDialogActions}>
        <Button type="button" disabled={!saved()} onClick={() => submitRecoveryPrompt('')}>
          {t('common.done')}
        </Button>
      </div>
    </div>
  );
};

const EnterCodeView: Component<{ error?: string }> = (props) => {
  const [value, setValue] = createSignal('');
  const [malformed, setMalformed] = createSignal(false);

  const complete = () => normalizeRecoveryCode(value()).length === RECOVERY_CODE_LENGTH;

  /**
   * Re-group as the user types, keeping the caret where they left it.
   *
   * Rewriting the value on every keystroke otherwise slides the caret to the end, which makes
   * correcting one wrong character in a 34-character code effectively impossible - and after
   * a mistyped code that is exactly what someone is trying to do. The caret is tracked by how
   * many code characters precede it, since the dashes move around.
   */
  function handleInput(e: InputEvent) {
    const el = e.currentTarget as HTMLInputElement;
    const raw = el.value;
    const caret = el.selectionStart ?? raw.length;
    const codeCharsBefore = normalizeRecoveryCode(raw.slice(0, caret)).length;
    const formatted = formatRecoveryCode(raw);

    setValue(formatted);
    setMalformed(false);

    let seen = 0;
    let position = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (seen === codeCharsBefore) {
        position = i;
        break;
      }
      if (formatted[i] !== '-') seen++;
    }
    // After the value prop lands, or Solid's update would overwrite the selection.
    queueMicrotask(() => el.setSelectionRange(position, position));
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (!complete()) return;
    // Checksum first: a typo should read as a typo, not as "wrong code", which a user hears
    // as "your history is gone".
    if (!(await isWellFormedRecoveryCode(value()))) {
      setMalformed(true);
      return;
    }
    setMalformed(false);
    submitRecoveryPrompt(value());
  }

  return (
    <form onSubmit={submit} class="space-y-4">
      <Input
        label={t('recovery.code')}
        autocomplete="off"
        autocapitalize="characters"
        autocorrect="off"
        spellcheck={false}
        placeholder={t('recovery.codePlaceholder')}
        // dir=ltr: the code is a fixed left-to-right sequence, and in an RTL locale the input
        // would otherwise render its groups in the opposite order to the one shown on setup.
        dir="ltr"
        class="text-center font-mono tracking-[0.15em] uppercase"
        value={value()}
        onInput={handleInput}
        error={(malformed() ? t('recovery.codeMalformed') : props.error) || undefined}
        autofocus
      />
      <div class="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => cancelRecoveryPrompt('lostCode')}>
          {t('recovery.lostCode')}
        </Button>
        <div class="flex gap-2">
          <Button type="button" variant="outline" onClick={() => cancelRecoveryPrompt('dismissed')}>
            {t('recovery.later')}
          </Button>
          <Button type="submit" disabled={!complete()}>
            {t('recovery.restore')}
          </Button>
        </div>
      </div>
    </form>
  );
};

const EnterPinView: Component<{ error?: string }> = (props) => {
  const [pin, setPin] = createSignal('');
  const [tooShort, setTooShort] = createSignal(false);

  function submit(e: Event) {
    e.preventDefault();
    const value = pin().trim();
    if (value.length < 6) {
      setTooShort(true);
      return;
    }
    setTooShort(false);
    setPin('');
    submitRecoveryPrompt(value);
  }

  return (
    <form onSubmit={submit} class="space-y-4">
      <Input
        type="password"
        label={t('recovery.pin')}
        inputmode="numeric"
        pattern="[0-9]*"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck={false}
        placeholder={t('recovery.pinPlaceholder')}
        class="text-center font-mono tracking-[0.35em]"
        value={pin()}
        maxlength={12}
        onInput={(e) => {
          setPin((e.target as HTMLInputElement).value);
          setTooShort(false);
        }}
        error={(tooShort() ? t('recovery.pinTooShort') : props.error) || undefined}
        autofocus
      />
      <div class="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => cancelRecoveryPrompt('lostCode')}>
          {t('recovery.lostPin')}
        </Button>
        <div class="flex gap-2">
          <Button type="button" variant="outline" onClick={() => cancelRecoveryPrompt('dismissed')}>
            {t('recovery.later')}
          </Button>
          <Button type="submit" disabled={pin().trim().length < 6}>
            {t('recovery.importOld')}
          </Button>
        </div>
      </div>
    </form>
  );
};

export const RecoveryModal: Component = () => {
  const pending = () => recoveryPrompt.pending;
  const kind = () => pending()?.kind;

  const title = () => {
    switch (kind()) {
      case 'showCode':
        return t('recovery.createTitle');
      case 'enterCode':
        return t('recovery.restoreTitle');
      default:
        return t('recovery.migrateTitle');
    }
  };

  const description = () => {
    switch (kind()) {
      case 'showCode':
        return t('recovery.createBody');
      case 'enterCode':
        return t('recovery.restoreBody');
      default:
        return t('recovery.migrateBody');
    }
  };

  return (
    <Show when={pending()}>
      {(prompt) => (
        <ResponsiveDialog
          size="md"
          zClass={zLayer.critical}
          // Dismissible, including the "save your code" view: the backup is not created until
          // that view is confirmed (see createBackupWithPrompt), so closing it changes
          // nothing and is always safe. Trapping the user in a modal they cannot answer
          // right now would be the worse failure.
          onClose={() => cancelRecoveryPrompt('dismissed')}
          closeButton
          title={title()}
          description={description()}
          icon="fa-solid fa-key"
        >
          <Switch>
            <Match when={prompt().kind === 'showCode'}>
              <ShowCodeView code={prompt().code ?? ''} />
            </Match>
            <Match when={prompt().kind === 'enterCode'}>
              <EnterCodeView error={recoveryPrompt.lastSubmitError ?? undefined} />
            </Match>
            <Match when={prompt().kind === 'enterLegacyPin'}>
              <EnterPinView error={recoveryPrompt.lastSubmitError ?? undefined} />
            </Match>
          </Switch>
        </ResponsiveDialog>
      )}
    </Show>
  );
};
