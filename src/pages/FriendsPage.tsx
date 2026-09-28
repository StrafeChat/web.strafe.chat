import type { Component, JSX } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import {
  relationships,
  RelType,
  friendDisplayName,
  loadRelationships,
  removeRelationshipLocally,
} from '../stores/relationships';
import type { Relationship } from '../api/relationships';
import { presence, isVisibleStatus } from '../stores/presence';
import { PresenceDot } from '../components/PresenceDot';
import { MessageAvatar } from '../components/messageList/MessageAvatar';
import { sendFriendRequest, putRelationship, removeRelationship } from '../api/relationships';
import { createPM, createPMByHandle } from '../api/rooms';
import { addOrUpdateRoom } from '../stores/rooms';
import { instance } from '../stores/instance';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { EmptyState } from '../components/ui/EmptyState';
import { showContextMenu } from '../stores/contextMenu';
import { ResponsiveDialog } from '../components/ui/ResponsiveDialog';
import { appDialogActions, appPageHeader, appPageTitle, appSectionLabel } from '../theme/appChrome';
import { t } from '../i18n';

type TabId = 'online' | 'all' | 'pending' | 'blocked';

function friendStatusText(rel: Relationship): string | undefined {
  return presence.byUser[rel.user.id]?.custom_status ?? rel.user.presence?.custom_status;
}

function userTag(rel: Relationship): string {
  return `${rel.user.username}#${rel.user.discriminator}`;
}

const TAB_IDS: TabId[] = ['online', 'all', 'pending', 'blocked'];

/** One person row - the same shape in every tab, only the trailing actions differ. */
const FriendRow: Component<{
  rel: Relationship;
  showPresence?: boolean;
  /** Dim the avatar (blocked / outgoing). */
  muted?: boolean;
  actions: JSX.Element;
  onContextMenu?: (e: MouseEvent) => void;
}> = (props) => (
  <div
    class="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/40"
    onContextMenu={(e) => props.onContextMenu?.(e)}
  >
    <div class="flex min-w-0 items-center gap-3">
      <div class={`relative shrink-0 ${props.muted ? 'opacity-70' : ''}`}>
        <MessageAvatar name={friendDisplayName(props.rel)} avatar={props.rel.user.avatar} class="size-10 text-sm" />
        <Show when={props.showPresence}>
          <span class="absolute -bottom-px -end-px">
            <PresenceDot userId={props.rel.user.id} class="size-4" />
          </span>
        </Show>
      </div>
      <div class="min-w-0">
        <div class="truncate text-sm font-medium text-foreground">{friendDisplayName(props.rel)}</div>
        <div class="truncate text-xs text-muted-foreground">{friendStatusText(props.rel) || userTag(props.rel)}</div>
      </div>
    </div>
    <div class="flex shrink-0 gap-2">{props.actions}</div>
  </div>
);

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

  function closeAddModal() {
    setShowAddModal(false);
    setAddError('');
    setAddUsername('');
    setAddDiscriminator('');
  }

  async function handleAddFriend(e: Event) {
    e.preventDefault();
    const rawUsername = addUsername().trim();
    const discriminator = addDiscriminator().trim().replace(/^#/, '');
    setAddError('');
    // "name@other.instance" (or a full name#0001@other.instance): friend requests don't
    // cross instances, so open a direct message with them instead.
    if (rawUsername.includes('@')) {
      const handle = rawUsername.includes('#') ? rawUsername : rawUsername.replace('@', `#${discriminator}@`);
      if (!/#\d{1,4}@/.test(handle)) {
        setAddError(t('friends.errors.handleFormat'));
        return;
      }
      setAddLoading(true);
      try {
        const room = await createPMByHandle(handle);
        addOrUpdateRoom(room);
        closeAddModal();
        navigate(`/rooms/${room.id}`);
      } catch (err) {
        setAddError(err instanceof Error ? err.message : t('friends.errors.unreachable'));
      } finally {
        setAddLoading(false);
      }
      return;
    }
    const username = rawUsername;
    if (!username || !discriminator) {
      setAddError(t('friends.errors.required'));
      return;
    }
    setAddLoading(true);
    try {
      await sendFriendRequest({ username, discriminator });
      await loadRelationships();
      closeAddModal();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t('friends.errors.sendFailed'));
    } finally {
      setAddLoading(false);
    }
  }

  async function handleAccept(rel: Relationship) {
    const id = rel.user.id;
    setActionLoading(id);
    try {
      await putRelationship(id);
      // RELATIONSHIP_ADD event will update the list
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemove(rel: Relationship) {
    const id = rel.user.id;
    setActionLoading(id);
    try {
      await removeRelationship(id);
      removeRelationshipLocally(id);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMessage(rel: Relationship) {
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
      (r) => isVisibleStatus(presence.byUser[r.user.id]?.status) || isVisibleStatus(r.user.presence?.status)
    );

  const hasAny = () =>
    friends().length > 0 || incoming().length > 0 || outgoing().length > 0 || blocked().length > 0;

  const hasTabContent = () => {
    switch (tab()) {
      case 'online':
        return onlineFriends().length > 0;
      case 'all':
        return friends().length > 0;
      case 'pending':
        return incoming().length > 0 || outgoing().length > 0;
      case 'blocked':
        return blocked().length > 0;
      default:
        return false;
    }
  };

  const showEmptyState = () => !relationships.loading && !hasTabContent();

  const pendingCount = () => incoming().length;

  const tabItems = () =>
    TAB_IDS.map((id) => ({
      id,
      label: id === 'pending' && pendingCount() > 0 ? t('friends.tabs.pendingCount', { count: pendingCount() }) : t(`friends.tabs.${id}`),
    }));

  function friendMenu(rel: Relationship) {
    return (e: MouseEvent) =>
      showContextMenu(e, [
        { label: t('friends.actions.message'), icon: 'fa-message', onClick: () => handleMessage(rel) },
        { label: t('userArea.copyUsername'), icon: 'fa-copy', onClick: () => navigator.clipboard.writeText(userTag(rel)) },
        {
          label: t('friends.actions.removeFriend'),
          icon: 'fa-user-minus',
          danger: true,
          onClick: () => handleRemove(rel).catch(() => {}),
        },
      ]);
  }

  const messageAction = (rel: Relationship) => (
    <Button
      size="sm"
      variant="outline"
      onClick={() => handleMessage(rel)}
      disabled={messageLoading() === rel.user.id}
      loading={messageLoading() === rel.user.id}
    >
      {t('friends.actions.message')}
    </Button>
  );

  const addFriendButton = (size: 'sm' | 'md' = 'md') => (
    <Button size={size} class="shrink-0 whitespace-nowrap" onClick={() => setShowAddModal(true)}>
      <i class="fa-solid fa-user-plus text-xs" aria-hidden="true" />
      {t('friends.addFriend')}
    </Button>
  );

  return (
    <div class="flex min-h-0 flex-1 flex-col bg-transparent">
      <Show when={showAddModal()}>
          <ResponsiveDialog
            size="sm"
            onClose={closeAddModal}
            dismissible={!addLoading()}
            title={t('friends.addFriend')}
            description={
              <>
                {t('friends.addHelp')} <span class="font-mono text-foreground">turtle#1234</span>.
                <Show when={instance.federationEnabled}>
                  {' '}
                  {t('friends.addHelpFederated')} <span class="font-mono text-foreground">turtle#1234@their.instance</span>{' '}
                  {t('friends.addHelpFederatedAfter')}
                </Show>
              </>
            }
          >
            <form onSubmit={handleAddFriend} class="space-y-4">
              <div class="grid grid-cols-[1fr_6.5rem] gap-2">
                <Input
                  type="text"
                  label={t('friends.username')}
                  placeholder={t('friends.usernamePlaceholder')}
                  value={addUsername()}
                  onInput={(e) => {
                    setAddUsername(e.currentTarget.value);
                    setAddError('');
                  }}
                  disabled={addLoading()}
                  autocomplete="off"
                  autofocus
                />
                <Input
                  type="text"
                  label={t('friends.tag')}
                  placeholder="#1234"
                  inputmode="numeric"
                  value={addDiscriminator()}
                  onInput={(e) => {
                    setAddDiscriminator(e.currentTarget.value);
                    setAddError('');
                  }}
                  disabled={addLoading()}
                  error={addError() || undefined}
                  class="font-mono"
                />
              </div>
              <div class={appDialogActions}>
                <Button type="button" variant="outline" onClick={closeAddModal} disabled={addLoading()}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  loading={addLoading()}
                  disabled={!addUsername().trim() || (!addDiscriminator().trim() && !/#\d{1,4}@/.test(addUsername()))}
                >
                  {t('friends.sendRequest')}
                </Button>
              </div>
            </form>
          </ResponsiveDialog>
      </Show>
      <div class={`${appPageHeader} gap-3`}>
        <div class="flex min-w-0 items-center gap-2">
          <i class="fa-solid fa-user-group shrink-0 text-muted-foreground" aria-hidden="true" />
          <h1 class={appPageTitle}>{t('nav.friends')}</h1>
        </div>
        <Tabs<TabId>
          size="sm"
          aria-label={t('friends.listAria')}
          value={tab()}
          onChange={(v) => setTab(v)}
          items={tabItems()}
          class="ms-1"
        />
        <div class="ms-auto shrink-0">{addFriendButton('sm')}</div>
      </div>
      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-transparent">
        <Show when={relationships.loading}>
          <div class="flex flex-1 items-center justify-center p-8">
            <span class="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </Show>
        <Show when={!relationships.loading && !hasAny()}>
          <EmptyState
            size="page"
            icon="fa-solid fa-user-group"
            title={t('friends.empty.noneTitle')}
            body={t('friends.empty.noneBody')}
            action={addFriendButton()}
          />
        </Show>
        <Show when={!relationships.loading && hasAny() && showEmptyState()}>
          <EmptyState
            size="page"
            icon={
              tab() === 'blocked'
                ? 'fa-solid fa-ban'
                : tab() === 'pending'
                  ? 'fa-solid fa-envelope-open'
                  : 'fa-solid fa-user-group'
            }
            title={t(`friends.empty.${tab()}Title`)}
            body={t(`friends.empty.${tab()}Body`)}
            action={tab() !== 'online' && tab() !== 'blocked' ? addFriendButton() : undefined}
          />
        </Show>
        <Show when={!relationships.loading && hasAny() && !showEmptyState()}>
          <div class="mx-auto w-full max-w-3xl space-y-6 p-4">
            <Show when={tab() === 'online'}>
              <section>
                <h3 class={`mb-2 px-3 ${appSectionLabel}`}>{t('friends.sections.online', { count: onlineFriends().length })}</h3>
                <div class="space-y-0.5">
                  <For each={onlineFriends()}>
                    {(rel) => (
                      <FriendRow rel={rel} showPresence actions={messageAction(rel)} onContextMenu={friendMenu(rel)} />
                    )}
                  </For>
                </div>
              </section>
            </Show>
            <Show when={tab() === 'all' && friends().length > 0}>
              <section>
                <h3 class={`mb-2 px-3 ${appSectionLabel}`}>{t('friends.sections.all', { count: friends().length })}</h3>
                <div class="space-y-0.5">
                  <For each={friends()}>
                    {(rel) => (
                      <FriendRow rel={rel} showPresence actions={messageAction(rel)} onContextMenu={friendMenu(rel)} />
                    )}
                  </For>
                </div>
              </section>
            </Show>
            <Show when={tab() === 'pending' && (incoming().length > 0 || outgoing().length > 0)}>
              <div class="space-y-6">
                <Show when={incoming().length > 0}>
                  <section>
                    <h3 class={`mb-2 px-3 ${appSectionLabel}`}>{t('friends.sections.incoming', { count: incoming().length })}</h3>
                    <div class="space-y-0.5">
                      <For each={incoming()}>
                        {(rel) => (
                          <FriendRow
                            rel={rel}
                            actions={
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleAccept(rel)}
                                  disabled={actionLoading() === rel.user.id}
                                  loading={actionLoading() === rel.user.id}
                                >
                                  {t('friends.actions.accept')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRemove(rel)}
                                  disabled={actionLoading() === rel.user.id}
                                >
                                  {t('friends.actions.decline')}
                                </Button>
                              </>
                            }
                          />
                        )}
                      </For>
                    </div>
                  </section>
                </Show>
                <Show when={outgoing().length > 0}>
                  <section>
                    <h3 class={`mb-2 px-3 ${appSectionLabel}`}>{t('friends.sections.sent', { count: outgoing().length })}</h3>
                    <div class="space-y-0.5">
                      <For each={outgoing()}>
                        {(rel) => (
                          <FriendRow
                            rel={rel}
                            muted
                            actions={
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRemove(rel)}
                                disabled={actionLoading() === rel.user.id}
                                loading={actionLoading() === rel.user.id}
                              >
                                {t('common.cancel')}
                              </Button>
                            }
                          />
                        )}
                      </For>
                    </div>
                  </section>
                </Show>
              </div>
            </Show>
            <Show when={tab() === 'blocked' && blocked().length > 0}>
              <section>
                <h3 class={`mb-2 px-3 ${appSectionLabel}`}>{t('friends.sections.blocked', { count: blocked().length })}</h3>
                <div class="space-y-0.5">
                  <For each={blocked()}>
                    {(rel) => (
                      <FriendRow
                        rel={rel}
                        muted
                        actions={
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemove(rel)}
                            disabled={actionLoading() === rel.user.id}
                            loading={actionLoading() === rel.user.id}
                          >
                            {t('friends.actions.unblock')}
                          </Button>
                        }
                      />
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
