import type { Component, JSX } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import {
  AUTOMOD_DEFAULT_MENTION_LIMIT,
  AUTOMOD_INVITE_LINKS,
  AUTOMOD_MASS_MENTIONS,
  AUTOMOD_MAX_MENTION_LIMIT,
  AUTOMOD_REPEATED_MESSAGES,
  VERIFICATION_LEVELS,
  patchSpace,
  type PatchSpaceInput,
  type Space,
} from '../../../api/spaces';
import { addOrUpdateSpace } from '../../../stores/spaces';
import { Input } from '../../ui/Input';
import { Toggle } from '../../ui/Toggle';
import { settingsGroupFrame, settingsRowIcon, settingsRowShell, settingsSectionTitle } from '../settingsChrome';
import { t } from '../../../i18n';

interface Props {
  spaceId: string;
  space: Space | undefined;
  canManage: boolean;
  onError: (msg: string) => void;
}

const Row: Component<{ icon: string; title: string; description: string; control: JSX.Element }> = (props) => (
  <div class={settingsRowShell}>
    <div class={settingsRowIcon}>
      <i class={`fa-solid ${props.icon} text-sm`} aria-hidden="true" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-[15px] font-semibold text-foreground">{props.title}</p>
      <p class="mt-0.5 text-xs leading-snug text-muted-foreground">{props.description}</p>
    </div>
    <div class="shrink-0">{props.control}</div>
  </div>
);

const LEVEL_KEYS = ['none', 'low', 'medium', 'high'] as const;

/**
 * Space settings → Moderation: the verification level (what a member with no role must
 * satisfy before they can talk - raid protection) and the light automod rules. Every
 * control saves on change; the space in the store is replaced with the server's copy.
 */
export const SpaceModerationPage: Component<Props> = (props) => {
  const [busy, setBusy] = createSignal(false);
  const flags = () => props.space?.automod_flags ?? 0;
  const level = () => props.space?.verification_level ?? 0;
  const mentionLimit = () => props.space?.automod_mention_limit || AUTOMOD_DEFAULT_MENTION_LIMIT;
  const [limitDraft, setLimitDraft] = createSignal<string | null>(null);

  async function patch(body: PatchSpaceInput) {
    if (!props.canManage || busy()) return;
    setBusy(true);
    props.onError('');
    try {
      addOrUpdateSpace(await patchSpace(props.spaceId, body));
    } catch (e) {
      props.onError(e instanceof Error ? e.message : t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  function setFlag(bit: number, on: boolean) {
    void patch({ automod_flags: on ? flags() | bit : flags() & ~bit });
  }

  function commitLimit() {
    const raw = limitDraft();
    setLimitDraft(null);
    if (raw === null) return;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > AUTOMOD_MAX_MENTION_LIMIT || n === mentionLimit()) return;
    void patch({ automod_mention_limit: n });
  }

  return (
    <div class="max-w-2xl space-y-8">
      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('spaceSettings.moderation.verificationTitle')}</h3>
        <p class="text-xs text-muted-foreground">{t('spaceSettings.moderation.verificationHint')}</p>
        <div class="space-y-1.5" role="radiogroup" aria-label={t('spaceSettings.moderation.verificationTitle')}>
          <For each={VERIFICATION_LEVELS}>
            {(lvl) => {
              const on = () => level() === lvl;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={on()}
                  disabled={!props.canManage || busy()}
                  class={`${settingsRowShell} w-full text-start transition-colors ${on() ? 'ring-1 ring-inset ring-primary/50' : ''} disabled:opacity-60`}
                  onClick={() => {
                    if (!on()) void patch({ verification_level: lvl });
                  }}
                >
                  <div class={`${settingsRowIcon} ${on() ? 'text-primary' : ''}`}>
                    <i class={`fa-solid ${on() ? 'fa-circle-dot' : 'fa-circle'} text-sm`} aria-hidden="true" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[15px] font-semibold text-foreground">{t(`spaceSettings.moderation.levels.${LEVEL_KEYS[lvl]}.title`)}</p>
                    <p class="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {t(`spaceSettings.moderation.levels.${LEVEL_KEYS[lvl]}.description`)}
                    </p>
                  </div>
                </button>
              );
            }}
          </For>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('spaceSettings.moderation.automodTitle')}</h3>
        <p class="text-xs text-muted-foreground">{t('spaceSettings.moderation.automodHint')}</p>
        <div class={`${settingsGroupFrame} space-y-1.5`}>
          <Row
            icon="fa-repeat"
            title={t('spaceSettings.moderation.repeated.title')}
            description={t('spaceSettings.moderation.repeated.description')}
            control={
              <Toggle
                checked={(flags() & AUTOMOD_REPEATED_MESSAGES) !== 0}
                disabled={!props.canManage || busy()}
                label={t('spaceSettings.moderation.repeated.title')}
                onChange={(on) => setFlag(AUTOMOD_REPEATED_MESSAGES, on)}
              />
            }
          />
          <Row
            icon="fa-link-slash"
            title={t('spaceSettings.moderation.invites.title')}
            description={t('spaceSettings.moderation.invites.description')}
            control={
              <Toggle
                checked={(flags() & AUTOMOD_INVITE_LINKS) !== 0}
                disabled={!props.canManage || busy()}
                label={t('spaceSettings.moderation.invites.title')}
                onChange={(on) => setFlag(AUTOMOD_INVITE_LINKS, on)}
              />
            }
          />
          <Row
            icon="fa-at"
            title={t('spaceSettings.moderation.mentions.title')}
            description={t('spaceSettings.moderation.mentions.description')}
            control={
              <Toggle
                checked={(flags() & AUTOMOD_MASS_MENTIONS) !== 0}
                disabled={!props.canManage || busy()}
                label={t('spaceSettings.moderation.mentions.title')}
                onChange={(on) => setFlag(AUTOMOD_MASS_MENTIONS, on)}
              />
            }
          />
          <Show when={(flags() & AUTOMOD_MASS_MENTIONS) !== 0}>
            <div class="px-3 pb-2 pt-1">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={AUTOMOD_MAX_MENTION_LIMIT}
                label={t('spaceSettings.moderation.mentions.limit')}
                value={limitDraft() ?? String(mentionLimit())}
                disabled={!props.canManage || busy()}
                onInput={(e) => setLimitDraft(e.currentTarget.value)}
                onBlur={commitLimit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitLimit();
                  }
                }}
              />
              <p class="mt-1 text-xs text-muted-foreground">{t('spaceSettings.moderation.mentions.limitHint', { max: String(AUTOMOD_MAX_MENTION_LIMIT) })}</p>
            </div>
          </Show>
        </div>
      </section>
    </div>
  );
};
