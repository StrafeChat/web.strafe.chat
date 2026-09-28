import type { Component } from 'solid-js';
import { createSignal, Show, createMemo } from 'solid-js';
import { createSpaceRoom, type SpaceRoom } from '../api/spaces';
import { refreshSpaceRooms } from '../stores/spaces';
import { Button } from './ui/Button';
import { Checkbox } from './ui/Checkbox';
import { Input } from './ui/Input';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { appDialogActions } from '../theme/appChrome';
import { t } from '../i18n';

const ROOM_TYPE_TEXT = 3;
const ROOM_TYPE_VOICE = 4;
const ROOM_TYPE_SECTION = 5;

export const CreateSpaceRoomModal: Component<{
  open: boolean;
  onClose: () => void;
  spaceId: string;
  /** Current room list — used to pick a sensible default parent section */
  spaceRooms: SpaceRoom[];
  /** If set, the new room is created under this section (e.g. from the + next to a section). */
  parentSectionId?: string | null;
  onCreated?: () => void;
}> = (props) => {
  const [name, setName] = createSignal('');
  const [type, setType] = createSignal<typeof ROOM_TYPE_TEXT | typeof ROOM_TYPE_VOICE>(ROOM_TYPE_TEXT);
  const [e2ee, setE2ee] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const isVoice = () => type() === ROOM_TYPE_VOICE;

  const parentSectionName = createMemo(() => {
    const id = props.parentSectionId?.trim();
    if (!id) return null;
    return props.spaceRooms.find((r) => r.id === id && r.type === ROOM_TYPE_SECTION)?.name ?? null;
  });

  /** The default "Text rooms" / "Voice rooms" section, when the space still has them. */
  function pickDefaultParent(): string | undefined {
    const sections = props.spaceRooms.filter((r) => r.type === ROOM_TYPE_SECTION);
    const want = isVoice() ? 'voice' : 'text';
    return sections.find((s) => (s.name ?? '').toLowerCase().includes(want))?.id;
  }

  function resolveParentId(): string | undefined {
    const forced = props.parentSectionId?.trim();
    if (forced) return forced;
    return pickDefaultParent();
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const n = name().trim();
    setError('');
    if (!n) {
      setError(t('common.nameRequired'));
      return;
    }
    const sid = props.spaceId;
    if (!sid) return;
    setLoading(true);
    try {
      const parentId = resolveParentId();
      await createSpaceRoom(sid, {
        name: n,
        type: type(),
        ...(parentId ? { parent_id: parentId } : {}),
        ...(e2ee() && !isVoice() ? { e2ee_enabled: true } : {}),
      });
      await refreshSpaceRooms(sid);
      props.onCreated?.();
      setLoading(false);
      handleClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createRoom.failed'));
    } finally {
      setLoading(false);
    }
  }

  function handleClose(force = false) {
    if (!force && loading()) return;
    props.onClose();
    setError('');
    setName('');
    setE2ee(false);
    setType(ROOM_TYPE_TEXT);
  }

  const typeOption = (value: typeof ROOM_TYPE_TEXT | typeof ROOM_TYPE_VOICE, icon: string, label: string, hint: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={type() === value}
      disabled={loading()}
      class={`flex flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors ${
        type() === value ? 'border-primary bg-primary/10' : 'border-border bg-muted/20 hover:bg-muted/30'
      }`}
      onClick={() => setType(value)}
    >
      <span class={`flex size-9 shrink-0 items-center justify-center rounded-lg ${type() === value ? 'bg-primary/15 text-primary' : 'bg-muted/60 text-muted-foreground'}`}>
        <i class={`fa-solid ${icon} text-sm`} aria-hidden="true" />
      </span>
      <span class="min-w-0">
        <span class="block text-sm font-semibold text-foreground">{label}</span>
        <span class="block text-xs leading-snug text-muted-foreground">{hint}</span>
      </span>
    </button>
  );

  return (
    <Show when={props.open}>
        <ResponsiveDialog
          size="md"
          onClose={() => handleClose(false)}
          dismissible={!loading()}
          title={t('createRoom.title')}
          description={
            <Show when={parentSectionName()} fallback={<>{t('createRoom.description')}</>}>
              {t('createRoom.underSectionBefore')}{' '}
              <span class="font-medium text-foreground">{parentSectionName()}</span>
              {t('createRoom.underSectionAfter')}
            </Show>
          }
        >
          <form onSubmit={handleSubmit} class="flex flex-col gap-4">
            <div role="radiogroup" aria-label={t('createRoom.typeLabel')} class="flex flex-col gap-2 sm:flex-row">
              {typeOption(ROOM_TYPE_TEXT, 'fa-hashtag', t('createRoom.typeText'), t('createRoom.typeTextHint'))}
              {typeOption(ROOM_TYPE_VOICE, 'fa-volume-high', t('createRoom.typeVoice'), t('createRoom.typeVoiceHint'))}
            </div>
            <div class="relative">
              <Input
                id="create-space-room-name"
                label={t('createRoom.name')}
                type="text"
                value={name()}
                onInput={(e) => {
                  setName(e.currentTarget.value);
                  setError('');
                }}
                placeholder={isVoice() ? t('createRoom.voicePlaceholder') : t('space.defaultRoom')}
                maxLength={100}
                disabled={loading()}
                error={error() || undefined}
                class="ps-8"
                autofocus
              />
              <i
                class={`fa-solid ${isVoice() ? 'fa-volume-high' : 'fa-hashtag'} pointer-events-none absolute start-3 top-[2.45rem] text-xs text-muted-foreground`}
                aria-hidden="true"
              />
            </div>
            <Show when={!isVoice()}>
              <Checkbox
                checked={e2ee()}
                onChange={setE2ee}
                disabled={loading()}
                label={
                  <span class="inline-flex items-center gap-1.5">
                    <i class="fa-solid fa-lock text-[11px] text-primary" aria-hidden="true" />
                    {t('createRoom.e2ee')}
                  </span>
                }
                description={t('createRoom.e2eeDescription')}
              />
            </Show>
            <div class={appDialogActions}>
              <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={loading()}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={loading()} disabled={!name().trim()}>
                {t('createRoom.submit')}
              </Button>
            </div>
          </form>
        </ResponsiveDialog>
    </Show>
  );
};

export const CreateSpaceSectionModal: Component<{
  open: boolean;
  onClose: () => void;
  spaceId: string;
  onCreated?: () => void;
}> = (props) => {
  const [name, setName] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const n = name().trim();
    setError('');
    if (!n) {
      setError(t('common.nameRequired'));
      return;
    }
    const sid = props.spaceId;
    if (!sid) return;
    setLoading(true);
    try {
      await createSpaceRoom(sid, { name: n, type: ROOM_TYPE_SECTION });
      await refreshSpaceRooms(sid);
      props.onCreated?.();
      setLoading(false);
      handleClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createSection.failed'));
    } finally {
      setLoading(false);
    }
  }

  function handleClose(force = false) {
    if (!force && loading()) return;
    props.onClose();
    setError('');
    setName('');
  }

  return (
    <Show when={props.open}>
        <ResponsiveDialog
          size="md"
          onClose={() => handleClose(false)}
          dismissible={!loading()}
          title={t('createSection.title')}
          description={t('createSection.description')}
        >
          <form onSubmit={handleSubmit} class="flex flex-col gap-4">
            <Input
              id="create-space-section-name"
              label={t('createSection.name')}
              type="text"
              value={name()}
              onInput={(e) => {
                setName(e.currentTarget.value);
                setError('');
              }}
              placeholder={t('createSection.namePlaceholder')}
              maxLength={100}
              disabled={loading()}
              error={error() || undefined}
              autofocus
            />
            <div class={appDialogActions}>
              <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={loading()}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={loading()} disabled={!name().trim()}>
                {t('createSection.submit')}
              </Button>
            </div>
          </form>
        </ResponsiveDialog>
    </Show>
  );
};
