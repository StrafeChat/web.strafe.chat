import type { Component } from 'solid-js';
import { createSignal, onMount, Show } from 'solid-js';
import { DISCOVER_TAGLINE_MAX, DISCOVER_TAGS_MAX, parseTags, type DiscoverListing, type ListingInput } from '../../api/discover';
import { translateCaughtApiError } from '../../lib/formatApiError';
import { confirmDialog } from '../../stores/confirmDialog';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { settingsGroupFrame, settingsSectionTitle } from './settingsChrome';
import { formatDate, t } from '../../i18n';

interface Props {
  load: () => Promise<DiscoverListing | null>;
  apply: (input: ListingInput) => Promise<DiscoverListing>;
  withdraw: () => Promise<void>;
  /** When set, listing is not possible and the form is replaced by this explanation. */
  blocked?: string;
  onError?: (msg: string) => void;
}

const STATUS_ICON: Record<DiscoverListing['status'], string> = {
  pending: 'fa-hourglass-half text-amber-500',
  approved: 'fa-circle-check text-emerald-500',
  denied: 'fa-circle-xmark text-destructive',
};

/**
 * One listing on Discover, from the applicant's side: where it stands (not listed,
 * waiting, listed, declined with the administrator's note), the tagline and tags that
 * go on the card, and apply / save / withdraw. Shared by a space's settings and an
 * application's bot settings; the caller supplies the API.
 */
export const DiscoverListingForm: Component<Props> = (props) => {
  const [listing, setListing] = createSignal<DiscoverListing | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [tagline, setTagline] = createSignal('');
  const [tags, setTags] = createSignal('');
  /** Also show this listing on the Discover page of instances we federate with. */
  const [federate, setFederate] = createSignal(true);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  function seed(l: DiscoverListing | null) {
    setListing(l);
    setTagline(l?.tagline ?? '');
    setTags((l?.tags ?? []).join(', '));
    // A listing from before this setting existed, and a brand new one, are both shared.
    setFederate(l?.federate ?? true);
  }

  onMount(async () => {
    try {
      seed(await props.load());
    } catch (e) {
      props.onError?.(translateCaughtApiError(e, t).join(' ') || t('discover.listing.loadFailed'));
    } finally {
      setLoading(false);
    }
  });

  const statusKey = () => {
    const l = listing();
    if (!l) return 'discover.listing.statusNone';
    return l.status === 'approved' ? 'discover.listing.statusApproved' : l.status === 'pending' ? 'discover.listing.statusPending' : 'discover.listing.statusDenied';
  };
  const when = (iso?: string) => (iso ? formatDate(iso, { dateStyle: 'medium' }) || iso : '');
  const parsedTags = () => parseTags(tags());
  const tagsTooMany = () => parsedTags().length > DISCOVER_TAGS_MAX;
  const submitKey = () => {
    const l = listing();
    if (!l) return 'discover.listing.apply';
    return l.status === 'approved' ? 'discover.listing.update' : l.status === 'denied' ? 'discover.listing.reapply' : 'discover.listing.update';
  };

  async function submit(e: Event) {
    e.preventDefault();
    if (tagsTooMany() || busy()) return;
    setBusy(true);
    setError('');
    try {
      seed(await props.apply({ tagline: tagline().trim(), tags: parsedTags(), federate: federate() }));
    } catch (err) {
      setError(translateCaughtApiError(err, t).join(' ') || t('discover.listing.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    const l = listing();
    if (!l) return;
    const ok = await confirmDialog({
      title: l.status === 'approved' ? t('discover.listing.withdraw') : t('discover.listing.withdrawPending'),
      body: t('discover.listing.withdrawConfirm'),
      confirmLabel: l.status === 'approved' ? t('discover.listing.withdraw') : t('discover.listing.withdrawPending'),
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await props.withdraw();
      seed(null);
    } catch (err) {
      setError(translateCaughtApiError(err, t).join(' ') || t('discover.listing.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="space-y-4" data-discover-listing>
      <div class={settingsSectionTitle}>{t('discover.listing.title')}</div>
      <p class="text-sm text-muted-foreground">{t('discover.listing.intro')}</p>
      <Show when={!loading()} fallback={<p class="text-sm text-muted-foreground">…</p>}>
        <Show when={!props.blocked} fallback={<div class={`${settingsGroupFrame} text-sm text-muted-foreground`}>{props.blocked}</div>}>
          <div class={`${settingsGroupFrame} space-y-1`} data-discover-status={listing()?.status ?? 'none'}>
            <div class="flex items-center gap-2 text-sm font-medium text-foreground">
              <i class={`fa-solid ${listing() ? STATUS_ICON[listing()!.status] : 'fa-circle text-muted-foreground'}`} aria-hidden="true" />
              {t(statusKey())}
            </div>
            <Show when={listing()}>
              {(l) => (
                <div class="text-xs text-muted-foreground">
                  {t('discover.listing.requestedAt', { date: when(l().requested_at) })}
                  <Show when={l().reviewed_at}> · {t('discover.listing.reviewedAt', { date: when(l().reviewed_at) })}</Show>
                </div>
              )}
            </Show>
            <Show when={listing()?.status === 'denied' && listing()?.note}>
              <div class="mt-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm">
                <div class="text-xs font-medium text-muted-foreground">{t('discover.listing.note')}</div>
                <div class="whitespace-pre-wrap text-foreground">{listing()!.note}</div>
              </div>
            </Show>
          </div>

          <form class={`${settingsGroupFrame} space-y-4`} onSubmit={(e) => void submit(e)}>
            <div>
              <Input
                label={t('discover.listing.tagline')}
                value={tagline()}
                maxLength={DISCOVER_TAGLINE_MAX}
                placeholder={t('discover.listing.taglinePlaceholder')}
                onInput={(e) => setTagline(e.currentTarget.value)}
              />
              <p class="mt-1 text-xs text-muted-foreground">
                {t('discover.listing.taglineHint')} {tagline().length}/{DISCOVER_TAGLINE_MAX}
              </p>
            </div>
            <div>
              <Input
                label={t('discover.listing.tags')}
                value={tags()}
                placeholder={t('discover.listing.tagsPlaceholder')}
                error={tagsTooMany() ? t('discover.listing.tooManyTags', { count: DISCOVER_TAGS_MAX }) : undefined}
                onInput={(e) => setTags(e.currentTarget.value)}
              />
              <p class="mt-1 text-xs text-muted-foreground">{t('discover.listing.tagsHint')}</p>
            </div>
            <Checkbox
              checked={federate()}
              disabled={busy()}
              onChange={setFederate}
              label={t('discover.listing.federate')}
              description={t('discover.listing.federateHint')}
            />
            <Show when={error()}>
              <p class="text-sm text-destructive" role="alert">{error()}</p>
            </Show>
            <div class="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" loading={busy()} disabled={tagsTooMany()}>
                {t(submitKey())}
              </Button>
              <Show when={listing()}>
                <Button type="button" size="sm" variant="outline" disabled={busy()} onClick={() => void withdraw()}>
                  {listing()!.status === 'approved' ? t('discover.listing.withdraw') : t('discover.listing.withdrawPending')}
                </Button>
              </Show>
            </div>
          </form>
        </Show>
      </Show>
    </div>
  );
};
