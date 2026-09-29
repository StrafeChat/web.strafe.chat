import type { Component } from 'solid-js';
import { createEffect, createSignal, Show } from 'solid-js';
import { patchSpace, uploadSpaceIcon, uploadSpaceBanner, type Space, type SpaceMember } from '../../../api/spaces';
import { addOrUpdateSpace } from '../../../stores/spaces';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Textarea } from '../../ui/Textarea';
import { SpaceDangerZone } from './SpaceDangerZone';
import { settingsSectionTitle } from '../settingsChrome';
import { t } from '../../../i18n';

interface Props {
  spaceId: string;
  space: Space | undefined;
  canManage: boolean;
  /** For the owner-only transfer picker in the danger zone. */
  members: SpaceMember[];
  viewerId: string | undefined;
  onDeleted?: () => void;
  onError: (msg: string) => void;
}

/** Space settings → Overview: icon, name, description, and the owner's danger zone. */
export const SpaceOverviewPage: Component<Props> = (props) => {
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [iconBusy, setIconBusy] = createSignal(false);
  const [bannerBusy, setBannerBusy] = createSignal(false);
  let fileInput: HTMLInputElement | undefined;
  let bannerInput: HTMLInputElement | undefined;

  createEffect(() => {
    setName(props.space?.name ?? '');
    setDescription(props.space?.description ?? '');
  });

  const dirty = () =>
    name().trim() !== (props.space?.name ?? '') || description().trim() !== (props.space?.description ?? '');

  async function save() {
    if (!props.canManage || !dirty()) return;
    const n = name().trim();
    if (!n) return;
    setSaving(true);
    props.onError('');
    try {
      const updated = await patchSpace(props.spaceId, { name: n, description: description().trim() });
      addOrUpdateSpace(updated);
    } catch (e) {
      props.onError(e instanceof Error ? e.message : t('spaceSettings.saveNameFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function onPickIcon(f: File | undefined) {
    if (!f || !props.canManage) return;
    setIconBusy(true);
    props.onError('');
    try {
      addOrUpdateSpace(await uploadSpaceIcon(props.spaceId, f));
    } catch (e) {
      props.onError(e instanceof Error ? e.message : t('spaceSettings.iconUploadFailed'));
    } finally {
      setIconBusy(false);
    }
  }

  async function onPickBanner(f: File | undefined) {
    if (!f || !props.canManage) return;
    setBannerBusy(true);
    props.onError('');
    try {
      addOrUpdateSpace(await uploadSpaceBanner(props.spaceId, f));
    } catch (e) {
      props.onError(e instanceof Error ? e.message : t('spaceSettings.overview.bannerUploadFailed'));
    } finally {
      setBannerBusy(false);
    }
  }

  return (
    <div class="max-w-2xl space-y-8">
      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('spaceSettings.overview.identity')}</h3>
        <div class="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div class="flex shrink-0 flex-col items-center gap-2">
            <div class="size-24 overflow-hidden rounded-3xl border border-border bg-muted/40">
              <Show
                when={props.space?.icon}
                fallback={
                  <div class="flex size-full items-center justify-center bg-primary/25 text-xl font-semibold text-foreground">
                    {(props.space?.name_acronym || props.space?.name || '?').slice(0, 2).toUpperCase()}
                  </div>
                }
              >
                <img src={props.space!.icon} alt="" class="size-full object-cover" />
              </Show>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              class="hidden"
              ref={(el) => {
                fileInput = el;
              }}
              onChange={(e) => {
                void onPickIcon(e.currentTarget.files?.[0]);
                e.currentTarget.value = '';
              }}
            />
            <Button size="sm" variant="outline" disabled={!props.canManage || iconBusy()} loading={iconBusy()} onClick={() => fileInput?.click()}>
              {t('spaceSettings.uploadIcon')}
            </Button>
          </div>
          <div class="min-w-0 flex-1 space-y-4">
            <Input
              label={t('common.name')}
              value={name()}
              maxLength={100}
              disabled={!props.canManage || saving()}
              onInput={(e) => setName(e.currentTarget.value)}
            />
            <Textarea
              label={t('spaceSettings.description')}
              value={description()}
              rows={4}
              maxLength={1000}
              disabled={!props.canManage || saving()}
              placeholder={t('spaceSettings.overview.descriptionPlaceholder')}
              hint={t('spaceSettings.overview.descriptionHint')}
              onInput={(e) => setDescription(e.currentTarget.value)}
            />
            <Show when={props.canManage}>
              <div class="flex justify-end">
                <Button onClick={() => void save()} disabled={!dirty() || !name().trim() || saving()} loading={saving()}>
                  {t('common.saveChanges')}
                </Button>
              </div>
            </Show>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('spaceSettings.overview.banner')}</h3>
        <p class="text-sm text-muted-foreground">{t('spaceSettings.overview.bannerHint')}</p>
        <div class="relative w-full overflow-hidden rounded-2xl border border-border bg-muted/40" style={{ 'aspect-ratio': '16 / 6' }}>
          <Show
            when={props.space?.banner}
            fallback={
              <div class="flex size-full items-center justify-center text-sm text-muted-foreground">
                {t('spaceSettings.overview.noBanner')}
              </div>
            }
          >
            <img src={props.space!.banner} alt="" class="size-full object-cover" />
          </Show>
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          class="hidden"
          ref={(el) => {
            bannerInput = el;
          }}
          onChange={(e) => {
            void onPickBanner(e.currentTarget.files?.[0]);
            e.currentTarget.value = '';
          }}
        />
        <Show when={props.canManage}>
          <Button size="sm" variant="outline" disabled={bannerBusy()} loading={bannerBusy()} onClick={() => bannerInput?.click()}>
            {t('spaceSettings.overview.uploadBanner')}
          </Button>
        </Show>
      </section>

      <SpaceDangerZone
        spaceId={props.spaceId}
        space={props.space}
        members={props.members}
        viewerId={props.viewerId}
        onDeleted={props.onDeleted}
      />
    </div>
  );
};
