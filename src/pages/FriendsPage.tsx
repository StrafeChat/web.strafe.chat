import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { relationships, RelType, friendDisplayName, loadRelationships, removeRelationshipLocally } from '../stores/relationships';
import { presence, isVisibleStatus } from '../stores/presence';
import { PresenceDot } from '../components/PresenceDot';
import { sendFriendRequest, putRelationship, removeRelationship } from '../api/relationships';
import { createPM } from '../api/rooms';
import { addOrUpdateRoom } from '../stores/rooms';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

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
  const navigate = useNavigate();
  const [tab, setTab] = createSignal<TabId>('all');
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [addUsername, setAddUsername] = createSignal('');
  const [addDiscriminator, setAddDiscriminator] = createSignal('');
  const [addError, setAddError] = createSignal('');
  const [addLoading, setAddLoading] = createSignal(false);
  const [actionLoading, setActionLoading] = createSignal<string | null>(null);
  const [messageLoading, setMessageLoading] = createSignal<string | null>(null);

  async function handleAddFriend(e: Event) {
    e.preventDefault();
    const username = addUsername().trim();
    const discriminator = addDiscriminator().trim().replace(/^#/, '');
    setAddError('');
    if (!username || !discriminator) {
      setAddError('Username and discriminator are required');
      return;
    }
    setAddLoading(true);
    try {
      await sendFriendRequest({ username, discriminator });
      await loadRelationships();
      setShowAddModal(false);
      setAddUsername('');
      setAddDiscriminator('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setAddLoading(false);
    }
  }

  async function handleAccept(rel: { user: { id: string } }) {
    const id = rel.user.id;
    setActionLoading(id);
    try {
      await putRelationship(id);
      // RELATIONSHIP_ADD event will update the list
    } catch {
      setActionLoading(null);
    }
    setActionLoading(null);
  }

  async function handleDecline(rel: { user: { id: string } }) {
    const id = rel.user.id;
    setActionLoading(id);
    try {
      await removeRelationship(id);
      removeRelationshipLocally(id);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancelRequest(rel: { user: { id: string } }) {
    const id = rel.user.id;
    setActionLoading(id);
    try {
      await removeRelationship(id);
      removeRelationshipLocally(id);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMessage(rel: { user: { id: string } }) {
    const userId = rel.user.id;
    setMessageLoading(userId);
    try {
      const room = await createPM(userId);
      addOrUpdateRoom(room);
      navigate(`/rooms/${room.id}`);
    } catch (err) {
      console.error('Open PM failed:', err);
    } finally {
      setMessageLoading(null);
    }
  }

  const friends = () => relationships.relationships.filter((r) => r.type === RelType.Friend);
  const incoming = () => relationships.relationships.filter((r) => r.type === RelType.IncomingRequest);
  const outgoing = () => relationships.relationships.filter((r) => r.type === RelType.OutgoingRequest);
  const blocked = () => relationships.relationships.filter((r) => r.type === RelType.Blocked);
  const onlineFriends = () =>
    friends().filter(
      (r) =>
        isVisibleStatus(presence.byUser[r.user.id]?.status) ||
        isVisibleStatus(r.user.presence?.status)
    );

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
      <Show when={showAddModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-modal>
          <div class="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg border border-border mx-4">
            <h3 class="text-lg font-semibold text-foreground mb-1">Add Friend</h3>
            <p class="text-sm text-muted-foreground mb-4">Enter username and discriminator (e.g. 1234).</p>
            <form onSubmit={handleAddFriend} class="space-y-4">
              <Input
                type="text"
                label="Username"
                placeholder="username"
                value={addUsername()}
                onInput={(e) => { setAddUsername(e.currentTarget.value); setAddError(''); }}
                disabled={addLoading()}
                autocomplete="username"
              />
              <Input
                type="text"
                label="Discriminator"
                placeholder="1234"
                value={addDiscriminator()}
                onInput={(e) => { setAddDiscriminator(e.currentTarget.value); setAddError(''); }}
                disabled={addLoading()}
              />
              {addError() && (
                <p class="text-xs text-destructive">{addError()}</p>
              )}
              <div class="flex gap-2">
                <Button
                  type="button"
                  class="flex-1"
                  variant="outline"
                  onClick={() => { setShowAddModal(false); setAddError(''); setAddUsername(''); setAddDiscriminator(''); }}
                  disabled={addLoading()}
                >
                  Cancel
                </Button>
                <Button type="submit" class="flex-1" loading={addLoading()}>
                  Send Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Show>
      <div class="h-12 flex items-center gap-2 px-4 border-b border-border shrink-0">
        <i class="fa-solid fa-user-group text-muted-foreground shrink-0" />
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
        <button
          type="button"
          class="ml-auto px-3 py-1.5 rounded text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
          onClick={() => setShowAddModal(true)}
        >
          Add Friend
        </button>
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
              onClick={() => setShowAddModal(true)}
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
                onClick={() => setShowAddModal(true)}
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
                          <div class="relative shrink-0">
                            <div class="size-10 rounded-full bg-primary/30 flex items-center justify-center text-sm font-medium">
                              {friendDisplayName(rel)[0].toUpperCase()}
                            </div>
                            <span class="absolute bottom-[-1px] right-[-1px]">
                              <PresenceDot userId={rel.user.id} class="size-4" />
                            </span>
                          </div>
                          <div>
                            <div class="font-medium">{friendDisplayName(rel)}</div>
                            <div class="text-xs text-muted-foreground">
                              {rel.user.username}#{rel.user.discriminator}
                            </div>
                          </div>
                        </div>
                        <div class="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMessage(rel)}
                            disabled={messageLoading() === rel.user.id}
                            loading={messageLoading() === rel.user.id}
                          >
                            Message
                          </Button>
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
                          <div class="relative">
                            <div class="size-10 rounded-full bg-primary/30 flex items-center justify-center text-sm font-medium">
                              {friendDisplayName(rel)[0].toUpperCase()}
                            </div>
                              <span class="absolute bottom-[-1px] right-[-1px]">
                                <PresenceDot userId={rel.user.id} class="size-4" />
                              </span>
                          </div>
                          <div>
                            <div class="font-medium">{friendDisplayName(rel)}</div>
                            <div class="text-xs text-muted-foreground">
                              {rel.user.username}#{rel.user.discriminator}
                            </div>
                          </div>
                        </div>
                        <div class="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMessage(rel)}
                            disabled={messageLoading() === rel.user.id}
                            loading={messageLoading() === rel.user.id}
                          >
                            Message
                          </Button>
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
                            <div class="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleAccept(rel)}
                                disabled={actionLoading() === rel.user.id}
                                loading={actionLoading() === rel.user.id}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDecline(rel)}
                                disabled={actionLoading() === rel.user.id}
                              >
                                Decline
                              </Button>
                            </div>
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelRequest(rel)}
                              disabled={actionLoading() === rel.user.id}
                            >
                              Cancel
                            </Button>
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
