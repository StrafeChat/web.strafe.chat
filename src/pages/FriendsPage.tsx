import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import { relationships, RelType, friendDisplayName } from '../stores/relationships';

const FriendsIcon = () => (
  <svg class="size-24 text-muted-foreground/40 mx-auto mb-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

type TabId = 'online' | 'all' | 'pending' | 'blocked';

const TABS: { id: TabId; label: string }[] = [
  { id: 'online', label: 'Online' },
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'blocked', label: 'Blocked' },
];

const FriendsPage: Component = () => {
  const [tab, setTab] = createSignal<TabId>('all');

  const friends = () => relationships.relationships.filter((r) => r.type === RelType.Friend);
  const incoming = () => relationships.relationships.filter((r) => r.type === RelType.IncomingRequest);
  const outgoing = () => relationships.relationships.filter((r) => r.type === RelType.OutgoingRequest);
  const blocked = () => relationships.relationships.filter((r) => r.type === RelType.Blocked);
  const onlineFriends = () => friends().filter((r) => r.user.online === true);

  const hasAny = () =>
    friends().length > 0 || incoming().length > 0 || outgoing().length > 0 || blocked().length > 0;

  const hasTabContent = () => {
    switch (tab()) {
      case 'online': return onlineFriends().length > 0;
      case 'all': return friends().length > 0;
      case 'pending': return incoming().length > 0 || outgoing().length > 0;
      case 'blocked': return blocked().length > 0;
      default: return false;
    }
  };

  const showEmptyState = () => !relationships.loading && !hasTabContent();

  return (
    <div class="flex-1 flex flex-col">
      <div class="h-12 flex items-center gap-1 px-4 border-b border-border shrink-0">
        <h1 class="text-base font-semibold text-foreground mr-4">Friends</h1>
        <div class="flex gap-0.5">
          {TABS.map((t) => (
            <button
              type="button"
              class={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                tab() === t.id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div class="flex-1 flex flex-col overflow-y-auto">
        <Show when={relationships.loading}>
          <div class="flex-1 flex items-center justify-center p-8">
            <span class="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </Show>
        <Show when={!relationships.loading && !hasAny()}>
          <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <FriendsIcon />
            <h2 class="text-2xl font-semibold text-foreground mb-2">Add friends to get started</h2>
            <p class="text-muted-foreground max-w-md mb-6">
              Search for friends by username and discriminator.
            </p>
            <button
              type="button"
              class="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors"
              // TODO: open Add Friend modal
            >
              Add Friend
            </button>
          </div>
        </Show>
        <Show when={!relationships.loading && hasAny() && showEmptyState()}>
          <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <FriendsIcon />
            <h2 class="text-xl font-semibold text-foreground mb-2">
              {tab() === 'online' && 'No friends online'}
              {tab() === 'all' && 'No friends yet'}
              {tab() === 'pending' && 'No pending requests'}
              {tab() === 'blocked' && 'No blocked users'}
            </h2>
            <p class="text-muted-foreground max-w-md mb-6">
              {tab() === 'online' && 'When friends are online, they\'ll appear here.'}
              {tab() === 'all' && 'Add friends to get started.'}
              {tab() === 'pending' && 'Friend requests will show up here.'}
              {tab() === 'blocked' && 'Blocked users will appear here.'}
            </p>
            {tab() !== 'online' && tab() !== 'blocked' && (
              <button
                type="button"
                class="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors"
                // TODO: open Add Friend modal
              >
                Add Friend
              </button>
            )}
          </div>
        </Show>
        <Show when={!relationships.loading && hasAny() && !showEmptyState()}>
          <div class="p-4 space-y-6">
            <Show when={tab() === 'online'}>
              <section>
                <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Online — {onlineFriends().length}
                </h3>
                <div class="space-y-1">
                  <For each={onlineFriends()}>
                    {(rel) => (
                      <div class="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors">
                        <div class="flex items-center gap-3">
                          <div class="relative">
                            <div class="size-10 rounded-full bg-primary/30 flex items-center justify-center text-sm font-medium">
                              {friendDisplayName(rel)[0].toUpperCase()}
                            </div>
                            <div class="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 border-2 border-background" title="Online" />
                          </div>
                          <div>
                            <div class="font-medium">{friendDisplayName(rel)}</div>
                            <div class="text-xs text-muted-foreground">
                              {rel.user.username}#{rel.user.discriminator}
                            </div>
                          </div>
                        </div>
                        <div class="flex gap-2">
                          {/* TODO: Message button */}
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </section>
            </Show>
            <Show when={tab() === 'all' && friends().length > 0}>
              <section>
                <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  All — {friends().length}
                </h3>
                <div class="space-y-1">
                  <For each={friends()}>
                    {(rel) => (
                      <div class="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors">
                        <div class="flex items-center gap-3">
                          <div class="size-10 rounded-full bg-primary/30 flex items-center justify-center text-sm font-medium">
                            {friendDisplayName(rel)[0].toUpperCase()}
                          </div>
                          <div>
                            <div class="font-medium">{friendDisplayName(rel)}</div>
                            <div class="text-xs text-muted-foreground">
                              {rel.user.username}#{rel.user.discriminator}
                            </div>
                          </div>
                        </div>
                        <div class="flex gap-2">
                          {/* TODO: Message button */}
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </section>
            </Show>
            <Show when={tab() === 'pending' && (incoming().length > 0 || outgoing().length > 0)}>
              <div class="space-y-4">
                <Show when={incoming().length > 0}>
                  <section>
                    <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Incoming — {incoming().length}
                    </h3>
                    <div class="space-y-1">
                      <For each={incoming()}>
                        {(rel) => (
                          <div class="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <div class="flex items-center gap-3">
                              <div class="size-10 rounded-full bg-primary/30 flex items-center justify-center text-sm font-medium">
                                {friendDisplayName(rel)[0].toUpperCase()}
                              </div>
                              <div>
                                <div class="font-medium">{friendDisplayName(rel)}</div>
                                <div class="text-xs text-muted-foreground">
                                  {rel.user.username}#{rel.user.discriminator}
                                </div>
                              </div>
                            </div>
                            {/* TODO: Accept / Decline buttons */}
                          </div>
                        )}
                      </For>
                    </div>
                  </section>
                </Show>
                <Show when={outgoing().length > 0}>
                  <section>
                    <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Sent — {outgoing().length}
                    </h3>
                    <div class="space-y-1">
                      <For each={outgoing()}>
                        {(rel) => (
                          <div class="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                            <div class="flex items-center gap-3">
                              <div class="size-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                {friendDisplayName(rel)[0].toUpperCase()}
                              </div>
                              <div>
                                <div class="font-medium">{friendDisplayName(rel)}</div>
                                <div class="text-xs text-muted-foreground">
                                  {rel.user.username}#{rel.user.discriminator}
                                </div>
                              </div>
                            </div>
                            <span class="text-xs text-muted-foreground">Pending</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </section>
                </Show>
              </div>
            </Show>
            <Show when={tab() === 'blocked' && blocked().length > 0}>
              <section>
                <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Blocked — {blocked().length}
                </h3>
                <div class="space-y-1">
                  <For each={blocked()}>
                    {(rel) => (
                      <div class="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors">
                        <div class="flex items-center gap-3">
                          <div class="size-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                            {friendDisplayName(rel)[0].toUpperCase()}
                          </div>
                          <div>
                            <div class="font-medium">{friendDisplayName(rel)}</div>
                            <div class="text-xs text-muted-foreground">
                              {rel.user.username}#{rel.user.discriminator}
                            </div>
                          </div>
                        </div>
                        {/* TODO: Unblock button */}
                      </div>
                    )}
                  </For>
                </div>
              </section>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default FriendsPage;
