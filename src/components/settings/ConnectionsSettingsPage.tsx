import type { Component } from 'solid-js';
import { createEffect, createSignal, For, Show, onMount } from 'solid-js';
import {
  CONNECTION_VISIBILITIES,
  getMyConnections,
  recheckConnection,
  removeConnection,
  setPublicPage,
  startConnection,
  updateConnection,
  verifyConnection,
} from '../../api/connections';
import type { ConnectionProvider, ConnectionProviderInfo, ConnectionVisibility, MyConnections, OwnConnection, StartedConnection } from '../../api/connections';
import { connectionsVersion, takeConnectionsCallback } from '../../stores/connections';
import { confirmDialog } from '../../stores/confirmDialog';
import { requestOpenExternalLink } from '../../stores/externalLink';
import { connectionErrorCode, connectionErrorText, connectionIcon, connectionLabel } from '../../lib/connections';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import { Checkbox } from '../ui/Checkbox';
import { settingsGroupFrame, settingsRowIcon, settingsRowShell, settingsSectionTitle } from './settingsChrome';
import { t } from '../../i18n';

const PROOF_PROVIDERS: readonly ConnectionProvider[] = ['domain', 'fediverse'];

/** A value to copy, with its label and a Copy button. */
const CopyField: Component<{ label: string; value: string }> = (props) => {
  const [copied, setCopied] = createSignal(false);
  return (
    <div class="space-y-1">
      <p class="text-xs font-medium text-muted-foreground">{props.label}</p>
      <div class="flex items-center gap-2">
        <code class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-background/70 px-2 py-1.5 font-mono text-xs text-foreground" data-copy-value>
          {props.value}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(props.value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied() ? t('common.copied') : t('common.copy')}
        </Button>
      </div>
    </div>
  );
};

/**
 * Adding one connection: the identifier (when the provider needs one), then either what to
 * publish and Verify (domain, fediverse) or a sign-in at the provider (Bluesky, GitHub, Discord).
 */
const AddConnection: Component<{
  provider: ConnectionProviderInfo;
  publicPage: boolean;
  onVerified: (c: OwnConnection, turnOnPublicPage: boolean) => void;
  onCancel: () => void;
}> = (props) => {
  const id = () => props.provider.id;
  const [identifier, setIdentifier] = createSignal('');
  const [started, setStarted] = createSignal<StartedConnection | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal('');
  const [wantPublicPage, setWantPublicPage] = createSignal(true);

  async function start() {
    if (busy()) return;
    setBusy(true);
    setErr('');
    try {
      const s = await startConnection(id(), props.provider.needs_identifier ? identifier().trim() : undefined);
      if (s.kind === 'oauth' && s.authorize_url) {
        window.location.assign(s.authorize_url);
        return;
      }
      setStarted(s);
    } catch (e) {
      setErr(connectionErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    const s = started();
    if (!s || busy()) return;
    setBusy(true);
    setErr('');
    try {
      const conn = await verifyConnection(id(), s.challenge_id);
      props.onVerified(conn, id() === 'fediverse' && !props.publicPage && wantPublicPage());
    } catch (e) {
      setErr(connectionErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  const placeholder = () => (id() === 'domain' ? t('connections.domain.placeholder') : id() === 'fediverse' ? t('connections.fediverse.placeholder') : t('connections.bluesky.placeholder'));
  const promptLabel = () => (id() === 'domain' ? t('connections.domain.prompt') : id() === 'fediverse' ? t('connections.fediverse.prompt') : t('connections.bluesky.prompt'));

  return (
    <div class={`${settingsGroupFrame} space-y-4`} data-connection-add={id()}>
      <div class="flex items-center gap-3">
        <div class={settingsRowIcon}>
          <i class={`${connectionIcon(id())} text-base`} aria-hidden="true" />
        </div>
        <p class="text-[15px] font-semibold text-foreground">{connectionLabel(id())}</p>
      </div>

      <Show when={!started()}>
        <Show
          when={props.provider.needs_identifier}
          fallback={<p class="text-xs leading-snug text-muted-foreground">{t('connections.oauth.hint', { provider: connectionLabel(id()) })}</p>}
        >
          <form
            class="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void start();
            }}
          >
            <Input
              label={promptLabel()}
              placeholder={placeholder()}
              value={identifier()}
              onInput={(e) => setIdentifier(e.currentTarget.value)}
              autocomplete="off"
              spellcheck={false}
              data-connection-identifier
            />
            <Show when={id() === 'bluesky'}>
              <p class="text-xs leading-snug text-muted-foreground">{t('connections.bluesky.hint')}</p>
            </Show>
          </form>
        </Show>
        <div class="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => props.onCancel()}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            loading={busy()}
            disabled={props.provider.needs_identifier && identifier().trim() === ''}
            onClick={() => void start()}
            data-connection-start
          >
            {props.provider.kind === 'oauth' ? t('connections.oauth.continueTo', { provider: connectionLabel(id()) }) : t('connections.start')}
          </Button>
        </div>
      </Show>

      <Show when={started()?.instructions}>
        {(ins) => (
          <div class="space-y-4">
            <Show when={id() === 'domain'}>
              <p class="text-xs leading-snug text-muted-foreground">{t('connections.domain.instructions')}</p>
              <div class="space-y-2 rounded-lg border border-border p-3">
                <p class="text-sm font-semibold text-foreground">{t('connections.domain.dnsTitle')}</p>
                <p class="text-xs text-muted-foreground">{t('connections.domain.dnsHint')}</p>
                <CopyField label={t('connections.domain.name')} value={ins().dns_name ?? ''} />
                <CopyField label={t('connections.domain.value')} value={ins().dns_value ?? ''} />
              </div>
              <div class="space-y-2 rounded-lg border border-border p-3">
                <p class="text-sm font-semibold text-foreground">{t('connections.domain.fileTitle')}</p>
                <p class="text-xs text-muted-foreground">{t('connections.domain.fileHint')}</p>
                <CopyField label={t('connections.domain.address')} value={ins().https_url ?? ''} />
                <CopyField label={t('connections.domain.contents')} value={ins().https_body ?? ''} />
              </div>
            </Show>
            <Show when={id() === 'fediverse'}>
              <p class="text-xs leading-snug text-muted-foreground">{t('connections.fediverse.instructions')}</p>
              <CopyField label={t('connections.fediverse.prompt')} value={ins().address ?? ''} />
              <Show when={!props.publicPage}>
                <Checkbox checked={wantPublicPage()} onChange={(v) => setWantPublicPage(v)} label={t('connections.fediverse.publicPage')} />
              </Show>
            </Show>
            <div class="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => props.onCancel()}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" loading={busy()} onClick={() => void verify()} data-connection-verify>
                {t('connections.verify')}
              </Button>
            </div>
          </div>
        )}
      </Show>

      <Show when={err()}>
        <p class="text-sm text-destructive" role="alert" data-connection-error>
          {err()}
        </p>
      </Show>
    </div>
  );
};

/**
 * Settings > Connections: accounts elsewhere, verified, on the profile. Each is visible to its
 * owner only until they choose otherwise (spec D-1); Strafe keeps the account's name and how it
 * was checked, never a password or token. An OAuth sign-in comes back through
 * /settings/connections, which hands the result over (stores/connections).
 */
export const ConnectionsSettingsPage: Component = () => {
  const [data, setData] = createSignal<MyConnections | null>(null);
  const [loadErr, setLoadErr] = createSignal('');
  const [notice, setNotice] = createSignal<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [adding, setAdding] = createSignal<ConnectionProviderInfo | null>(null);
  /** The connection just made, whose visibility the page asks about. */
  const [asking, setAsking] = createSignal<string | null>(null);
  const [rowBusy, setRowBusy] = createSignal<string | null>(null);
  const [rowErr, setRowErr] = createSignal<{ key: string; text: string } | null>(null);
  const [pageBusy, setPageBusy] = createSignal(false);

  const key = (c: Pick<OwnConnection, 'provider' | 'id'>) => `${c.provider}|${c.id}`;
  const list = () => data()?.connections ?? [];

  async function load(): Promise<MyConnections | null> {
    try {
      const d = await getMyConnections();
      setData(d);
      setLoadErr('');
      return d;
    } catch (e) {
      setLoadErr(connectionErrorText(e));
      return null;
    }
  }

  onMount(() => {
    const cb = takeConnectionsCallback();
    void load().then((d) => {
      if (!cb) return;
      if (cb.connected) {
        setNotice({ tone: 'ok', text: t('connections.connected', { provider: connectionLabel(cb.connected) }) });
        // Ask about the newest connection of that provider: the one just made.
        const newest = [...(d?.connections ?? [])]
          .filter((c) => c.provider === cb.connected)
          .sort((a, b) => b.verified_at.localeCompare(a.verified_at))[0];
        if (newest) setAsking(key(newest));
      } else if (cb.error) {
        setNotice({ tone: 'err', text: connectionErrorCode(cb.error) });
      }
    });
  });

  // Changes from another device (or a re-check) arrive as USER_CONNECTIONS_UPDATE.
  let seenVersion = connectionsVersion();
  createEffect(() => {
    const v = connectionsVersion();
    if (v === seenVersion) return;
    seenVersion = v;
    void load();
  });

  async function onVerified(conn: OwnConnection, turnOnPublicPage: boolean) {
    setAdding(null);
    if (turnOnPublicPage) {
      try {
        await setPublicPage(true);
      } catch {
        // The connection is made; the page can be turned on below.
      }
    }
    await load();
    setAsking(key(conn));
    setNotice(null);
  }

  async function rowAction(c: OwnConnection, run: () => Promise<unknown>) {
    const k = key(c);
    if (rowBusy()) return;
    setRowBusy(k);
    setRowErr(null);
    try {
      await run();
      await load();
    } catch (e) {
      setRowErr({ key: k, text: connectionErrorText(e) });
    } finally {
      setRowBusy(null);
    }
  }

  function setVisibility(c: OwnConnection, v: ConnectionVisibility) {
    const k = key(c);
    void rowAction(c, () => updateConnection(c, { visibility: v })).then(() => setAsking((cur) => (cur === k ? null : cur)));
  }

  /** Moves a connection one place, writing the positions that changed. */
  function move(c: OwnConnection, by: -1 | 1) {
    const order = [...list()];
    const i = order.findIndex((x) => key(x) === key(c));
    const j = i + by;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    void rowAction(c, async () => {
      for (const [pos, x] of order.entries()) {
        if (x.position !== pos) await updateConnection(x, { position: pos });
      }
    });
  }

  async function remove(c: OwnConnection) {
    const ok = await confirmDialog({
      title: t('connections.removeTitle', { name: c.name }),
      body: t('connections.removeBody'),
      confirmLabel: t('common.remove'),
      tone: 'danger',
    });
    if (ok) void rowAction(c, () => removeConnection(c));
  }

  async function togglePublicPage(on: boolean) {
    if (pageBusy()) return;
    setPageBusy(true);
    try {
      await setPublicPage(on);
      await load();
    } catch (e) {
      setNotice({ tone: 'err', text: connectionErrorText(e) });
    } finally {
      setPageBusy(false);
    }
  }

  const providers = () => data()?.providers ?? [];
  const publicPage = () => data()?.settings.public_page ?? false;

  return (
    <div class="max-w-2xl space-y-6" data-connections-settings>
      <p class="text-xs leading-snug text-muted-foreground">{t('connections.intro')}</p>

      <Show when={notice()}>
        {(n) => (
          <p class={`rounded-lg border px-3 py-2 text-sm ${n().tone === 'ok' ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-destructive/40 bg-destructive/10 text-destructive'}`} role="status" data-connections-notice>
            {n().text}
          </p>
        )}
      </Show>
      <Show when={loadErr()}>
        <p class="text-sm text-destructive" role="alert">{loadErr()}</p>
      </Show>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('connections.add')}</h3>
        <Show
          when={adding()}
          fallback={
            <div class="flex flex-wrap gap-2">
              <For each={providers()}>
                {(p) => (
                  <Button variant="outline" size="sm" onClick={() => setAdding(p)} data-connection-provider={p.id}>
                    <i class={`${connectionIcon(p.id)} me-2`} aria-hidden="true" />
                    {connectionLabel(p.id)}
                  </Button>
                )}
              </For>
            </div>
          }
        >
          {(p) => <AddConnection provider={p()} publicPage={publicPage()} onVerified={(c, on) => void onVerified(c, on)} onCancel={() => setAdding(null)} />}
        </Show>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('connections.title')}</h3>
        <Show when={data() && list().length === 0}>
          <p class="text-sm text-muted-foreground">{t('connections.none')}</p>
        </Show>
        <div class="space-y-1.5">
          <For each={list()}>
            {(c, i) => (
              <div class={`${settingsRowShell} flex-wrap ${asking() === key(c) ? 'ring-2 ring-primary/60' : ''}`} data-connection-row={key(c)}>
                <div class={settingsRowIcon}>
                  <i class={`${connectionIcon(c.provider)} text-base`} aria-hidden="true" />
                </div>
                <div class="min-w-0 flex-1">
                  <Show
                    when={c.url}
                    fallback={<p class="truncate text-[15px] font-semibold text-foreground">{c.name}</p>}
                  >
                    {(href) => (
                      <button type="button" class="max-w-full truncate text-start text-[15px] font-semibold text-foreground hover:underline" onClick={() => requestOpenExternalLink(href())}>
                        {c.name}
                      </button>
                    )}
                  </Show>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    {connectionLabel(c.provider)} ·{' '}
                    <Show
                      when={c.verified}
                      fallback={
                        <span class="text-amber-500" title={t('connections.notVerifiedHint')}>
                          <i class="fa-solid fa-triangle-exclamation me-1" aria-hidden="true" />
                          {t('connections.notVerified')}
                        </span>
                      }
                    >
                      <span class="text-primary">
                        <i class="fa-solid fa-circle-check me-1" aria-hidden="true" />
                        {t('connections.verified')}
                      </span>
                    </Show>
                  </p>
                  <Show when={asking() === key(c)}>
                    <p class="mt-1 text-xs font-medium text-foreground" data-connection-ask>
                      {t('connections.askVisibility')}
                    </p>
                  </Show>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  <div class="w-48">
                    <Select
                      aria-label={t('connections.visibility.label')}
                      value={c.visibility}
                      disabled={rowBusy() === key(c)}
                      onValueChange={(v) => setVisibility(c, v as ConnectionVisibility)}
                      data-connection-visibility
                    >
                      <For each={CONNECTION_VISIBILITIES}>{(v) => <option value={v}>{t(`connections.visibility.${v}`)}</option>}</For>
                    </Select>
                  </div>
                  <Show when={PROOF_PROVIDERS.includes(c.provider)}>
                    <Button variant="ghost" size="sm" aria-label={t('connections.recheck')} title={t('connections.recheck')} disabled={rowBusy() !== null} onClick={() => void rowAction(c, () => recheckConnection(c))}>
                      <i class="fa-solid fa-rotate" aria-hidden="true" />
                    </Button>
                  </Show>
                  <Button variant="ghost" size="sm" aria-label={t('connections.moveUp')} title={t('connections.moveUp')} disabled={i() === 0 || rowBusy() !== null} onClick={() => move(c, -1)}>
                    <i class="fa-solid fa-arrow-up" aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label={t('connections.moveDown')} title={t('connections.moveDown')} disabled={i() === list().length - 1 || rowBusy() !== null} onClick={() => move(c, 1)}>
                    <i class="fa-solid fa-arrow-down" aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label={t('common.remove')} title={t('common.remove')} disabled={rowBusy() !== null} onClick={() => void remove(c)} data-connection-remove>
                    <i class="fa-solid fa-trash-can text-destructive" aria-hidden="true" />
                  </Button>
                </div>
                <Show when={rowErr()?.key === key(c)}>
                  <p class="basis-full text-sm text-destructive" role="alert">{rowErr()?.text}</p>
                </Show>
              </div>
            )}
          </For>
        </div>
      </section>

      <Show when={data()?.address}>
        {(address) => (
          <section class="space-y-3">
            <h3 class={settingsSectionTitle}>{t('connections.publicPage.title')}</h3>
            <div class={settingsGroupFrame}>
              <div class={settingsRowShell}>
                <div class={settingsRowIcon}>
                  <i class="fa-solid fa-id-card text-sm" aria-hidden="true" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-[15px] font-semibold text-foreground">{t('connections.publicPage.label')}</p>
                  <p class="mt-0.5 text-xs leading-snug text-muted-foreground">{publicPage() ? t('connections.publicPage.on') : t('connections.publicPage.off')}</p>
                  <Show when={publicPage()}>
                    <a href={address()} target="_blank" rel="noopener" class="mt-1 inline-block break-all text-xs font-medium text-primary hover:underline" data-public-page-link>
                      {address()}
                    </a>
                  </Show>
                </div>
                <div class="shrink-0">
                  <Toggle checked={publicPage()} disabled={pageBusy()} label={t('connections.publicPage.label')} onChange={(on) => void togglePublicPage(on)} />
                </div>
              </div>
            </div>
          </section>
        )}
      </Show>
    </div>
  );
};
