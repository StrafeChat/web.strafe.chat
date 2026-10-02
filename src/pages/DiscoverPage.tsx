import type { Component } from 'solid-js';
import { createMemo, createResource, createSignal, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { MobileRailsOpenButton } from '../components/layout/MobileRailsOpenButton';
import { joinDiscoverSpace, listDiscoverBots, listDiscoverSpaces, type DiscoverEntry } from '../api/discover';
import { authorizeUrl } from '../api/developers';
import { getSpace } from '../api/spaces';
import { spaces, addOrUpdateSpace } from '../stores/spaces';
import { translateCaughtApiError } from '../lib/formatApiError';
import { MessageAvatar } from '../components/messageList/MessageAvatar';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Tabs } from '../components/ui/Tabs';
import { appContentBand, appPageHeader, appPageTitle } from '../theme/appChrome';
import { t } from '../i18n';

type TabId = 'spaces' | 'bots';

function matches(e: DiscoverEntry, q: string): boolean {
  if (!q) return true;
  const hay = [e.tagline, ...e.tags, e.space?.name, e.space?.description, e.bot?.name, e.bot?.description, e.bot?.bot?.username, e.bot?.bot?.display_name];
  return hay.some((h) => h && h.toLowerCase().includes(q));
}

const Tag: Component<{ label: string }> = (props) => (
  <span class="rounded-md bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{props.label}</span>
);

/**
 * Discover: the spaces and bots this instance's administrators listed. Spaces can be
 * joined without an invite; a bot's card opens its install page.
 */
const DiscoverPage: Component = () => {
  const navigate = useNavigate();
  const [tab, setTab] = createSignal<TabId>('spaces');
  const [query, setQuery] = createSignal('');
  const [spaceList] = createResource(() => listDiscoverSpaces());
  const [botList] = createResource(() => listDiscoverBots());
  const [joining, setJoining] = createSignal('');
  const [error, setError] = createSignal('');

  const q = createMemo(() => query().trim().toLowerCase());
  const visible = createMemo(() => {
    const list = (tab() === 'spaces' ? spaceList() : botList()) ?? [];
    return list.filter((e) => matches(e, q()));
  });
  const loading = () => (tab() === 'spaces' ? spaceList.loading : botList.loading);
  const failed = () => (tab() === 'spaces' ? spaceList.error : botList.error);
  const isMember = (id: string) => spaces.spaces.some((s) => s.id === id);

  async function join(e: DiscoverEntry) {
    const card = e.space;
    if (!card) return;
    if (isMember(card.id)) {
      navigate(`/spaces/${card.id}`);
      return;
    }
    setJoining(card.id);
    setError('');
    try {
      const joined = await joinDiscoverSpace(card.id);
      addOrUpdateSpace(await getSpace(joined.id));
      navigate(`/spaces/${joined.id}`);
    } catch (err) {
      setError(translateCaughtApiError(err, t)[0] ?? t('discover.joinFailed'));
    } finally {
      setJoining('');
    }
  }

  function addBot(e: DiscoverEntry) {
    if (!e.bot) return;
    const url = new URL(authorizeUrl({ clientId: e.bot.application_id, scopes: ['bot'] }));
    navigate(url.pathname + url.search);
  }

  return (
    <div class="flex h-full min-h-0 flex-col" data-discover-page>
      <div class={`${appPageHeader} gap-3`}>
        <MobileRailsOpenButton />
        <div class="flex min-w-0 items-center gap-2">
          <i class="fa-solid fa-compass text-muted-foreground" aria-hidden="true" />
          <h1 class={appPageTitle}>{t('discover.title')}</h1>
        </div>
        <div class="hidden md:block">
          <Tabs<TabId>
            size="sm"
            value={tab()}
            onChange={setTab}
            items={[
              { id: 'spaces', label: t('discover.tabs.spaces') },
              { id: 'bots', label: t('discover.tabs.bots') },
            ]}
          />
        </div>
      </div>
      <div class={`${appContentBand} shrink-0 px-3 py-2 md:hidden`}>
        <Tabs<TabId>
          size="sm"
          value={tab()}
          onChange={setTab}
          items={[
            { id: 'spaces', label: t('discover.tabs.spaces') },
            { id: 'bots', label: t('discover.tabs.bots') },
          ]}
        />
      </div>
      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div class="mx-auto w-full max-w-5xl space-y-4 p-4">
          <p class="text-sm text-muted-foreground">{t('discover.subtitle')}</p>
          <Input
            value={query()}
            placeholder={t('discover.search')}
            aria-label={t('discover.search')}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
          <Show when={error()}>
            <p class="text-sm text-destructive" role="alert">{error()}</p>
          </Show>
          <Show when={!loading()} fallback={<p class="text-sm text-muted-foreground">…</p>}>
            <Show when={!failed()} fallback={<EmptyState icon="fa-triangle-exclamation" title={t('discover.loadFailed')} size="inline" />}>
              <Show
                when={visible().length > 0}
                fallback={
                  <EmptyState
                    icon="fa-compass"
                    title={q() ? t('discover.noResults') : tab() === 'spaces' ? t('discover.emptySpaces') : t('discover.emptyBots')}
                    size="inline"
                  />
                }
              >
                <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <For each={visible()}>
                    {(e) => (
                      <Show when={e.space} fallback={<BotCard entry={e} onAdd={() => addBot(e)} />}>
                        {(card) => (
                          <article class="flex flex-col overflow-hidden rounded-xl border border-border bg-card/60" data-discover-card={card().id}>
                            <div class="h-20 bg-gradient-to-br from-primary/30 to-primary/5" style={card().banner ? { 'background-image': `url(${card().banner})`, 'background-size': 'cover', 'background-position': 'center' } : undefined} />
                            <div class="-mt-6 flex flex-1 flex-col gap-2 px-4 pb-4">
                              <MessageAvatar name={card().name} avatar={card().icon} class="size-12 rounded-xl border-2 border-card text-base" />
                              <div class="min-w-0">
                                <h2 class="truncate text-sm font-semibold text-foreground">{card().name}</h2>
                                <p class="text-xs text-muted-foreground">
                                  <span class="inline-block size-2 rounded-full bg-emerald-500 align-middle" aria-hidden="true" /> {t('discover.online', { count: card().online_count })} · {t('discover.members', { count: card().member_count })}
                                </p>
                              </div>
                              <p class="line-clamp-2 text-sm text-muted-foreground">{e.tagline || card().description}</p>
                              <Show when={e.tags.length > 0}>
                                <div class="flex flex-wrap gap-1"><For each={e.tags}>{(tg) => <Tag label={tg} />}</For></div>
                              </Show>
                              <div class="mt-auto pt-2">
                                <Button size="sm" class="w-full" variant={isMember(card().id) ? 'outline' : 'primary'} loading={joining() === card().id} onClick={() => void join(e)}>
                                  {isMember(card().id) ? t('discover.open') : t('discover.join')}
                                </Button>
                              </div>
                            </div>
                          </article>
                        )}
                      </Show>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
};

const BotCard: Component<{ entry: DiscoverEntry; onAdd: () => void }> = (props) => {
  const bot = () => props.entry.bot!;
  return (
    <article class="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4" data-discover-card={bot().application_id}>
      <div class="flex items-center gap-3">
        <MessageAvatar name={bot().bot?.display_name || bot().name} avatar={bot().bot?.avatar || bot().icon} class="size-12 rounded-xl text-base" />
        <div class="min-w-0">
          <h2 class="truncate text-sm font-semibold text-foreground">{bot().bot?.display_name || bot().name}</h2>
          <Show when={bot().bot}>{(u) => <p class="truncate text-xs text-muted-foreground">{u().username}#{u().discriminator}</p>}</Show>
        </div>
      </div>
      <p class="line-clamp-3 text-sm text-muted-foreground">{props.entry.tagline || bot().description}</p>
      <Show when={props.entry.tags.length > 0}>
        <div class="flex flex-wrap gap-1"><For each={props.entry.tags}>{(tg) => <Tag label={tg} />}</For></div>
      </Show>
      <div class="mt-auto pt-1">
        <Button size="sm" class="w-full" onClick={props.onAdd}>
          <i class="fa-solid fa-plus text-[10px]" aria-hidden="true" /> {t('discover.addBot')}
        </Button>
      </div>
    </article>
  );
};

export default DiscoverPage;
