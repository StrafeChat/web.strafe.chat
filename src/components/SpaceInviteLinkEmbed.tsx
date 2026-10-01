import type { Component } from 'solid-js';
import { createSignal, createResource, Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { getInvitePreview, joinSpaceByInvite } from '../api/spaces';
import { auth } from '../stores/auth';
import { spaces, addOrUpdateSpace } from '../stores/spaces';
import { Button } from './ui/Button';
import { t } from '../i18n';

export interface SpaceInviteLinkEmbedProps {
  code: string;
}

export const SpaceInviteLinkEmbed: Component<SpaceInviteLinkEmbedProps> = (props) => {
  const navigate = useNavigate();
  const [joining, setJoining] = createSignal(false);
  const [joinError, setJoinError] = createSignal('');

  const [preview] = createResource(
    () => props.code,
    async (c) => {
      if (!c) return null;
      return getInvitePreview(c);
    }
  );

  const isMember = (spaceId: string) => spaces.spaces.some((s) => s.id === spaceId);

  async function handleJoin(code: string) {
    setJoinError('');
    setJoining(true);
    try {
      const space = await joinSpaceByInvite(code);
      addOrUpdateSpace(space);
      navigate(`/spaces/${space.id}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : t('invite.joinFailed'));
    } finally {
      setJoining(false);
    }
  }

  return (
    <div class="block max-w-md w-full rounded-xl border border-border bg-card overflow-hidden text-start">
      <Show when={preview.state === 'pending'}>
        <div class="p-4 space-y-3 animate-pulse">
          <div class="h-20 rounded-lg bg-muted" />
          <div class="flex gap-3 items-start">
            <div class="size-16 shrink-0 rounded-xl bg-muted" />
            <div class="flex-1 flex flex-col gap-2 pt-0.5">
              <div class="h-4 w-2/3 rounded bg-muted" />
              <div class="h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
          <div class="h-10 rounded-md bg-muted" />
        </div>
      </Show>
      <Show when={preview.state === 'errored'}>
        <div class="p-4 text-sm text-muted-foreground">
          <p class="text-foreground font-medium">{t('invite.invalidTitle')}</p>
          <p class="mt-1">{t('invite.invalidShort')}</p>
          <A
            href={`/invite/${props.code}`}
            class="mt-2 inline-block text-primary text-sm underline underline-offset-2"
          >
            {t('invite.openPage')}
          </A>
        </div>
      </Show>
      <Show when={preview.state === 'ready' && preview()}>
        {(data) => {
          const d = data();
          const space = d.space;
          const banner = space.banner?.trim();
          const icon = space.icon?.trim();
          const acronym = space.name_acronym || space.name?.slice(0, 2).toUpperCase() || '?';
          const member = () => isMember(space.id);

          return (
            <>
              <Show when={banner}>
                <div
                  class="h-24 w-full bg-muted bg-cover bg-center"
                  style={{ 'background-image': `url(${banner})` }}
                  role="img"
                  aria-label=""
                />
              </Show>
              <div class={`px-4 pb-3 ${banner ? '-mt-8 pt-0' : 'pt-4'}`}>
                <div class="flex gap-3 items-start">
                  <div
                    class={`size-16 shrink-0 self-start rounded-xl border-2 border-card bg-muted overflow-hidden flex items-center justify-center text-xl font-bold text-primary ${
                      banner ? 'shadow-sm' : ''
                    }`}
                  >
                    <Show when={icon} fallback={<span aria-hidden>{acronym}</span>}>
                      <img src={icon!} alt="" class="size-full object-cover" />
                    </Show>
                  </div>
                  <div class="min-w-0 flex-1 flex flex-col gap-1 pt-0.5">
                    <h3 class="font-semibold text-foreground truncate leading-snug">{space.name}</h3>
                    <Show when={space.max_members > 0}>
                      <p class="text-xs text-muted-foreground leading-snug">
                        {t('invite.upToMembers', { count: space.max_members })}
                      </p>
                    </Show>
                    <Show when={d.inviter?.display_name}>
                      <p class="text-xs text-muted-foreground leading-snug">
                        {t('invite.invitedBy', { name: d.inviter!.display_name })}
                      </p>
                    </Show>
                    <Show when={space.federation?.origin_domain}>
                      {(domain) => (
                        <p class="text-xs text-muted-foreground leading-snug">{t('space.hostedOn', { domain: domain() })}</p>
                      )}
                    </Show>
                  </div>
                </div>
              </div>
              <div class="px-4 pb-4 pt-0 border-t border-border space-y-2">
                <Show when={joinError()}>
                  <p class="text-sm text-destructive pt-2">{joinError()}</p>
                </Show>
                <Show
                  when={auth.token}
                  fallback={
                    <div class="pt-3 space-y-2">
                      <p class="text-sm text-muted-foreground">{t('invite.logInToJoin')}</p>
                      <A
                        href={`/login?redirect=${encodeURIComponent(`/invite/${props.code}`)}`}
                      >
                        <Button class="w-full" size="md">
                          {t('invite.logIn')}
                        </Button>
                      </A>
                    </div>
                  }
                >
                  <div class="pt-3">
                    <Show
                      when={member()}
                      fallback={
                        <Button
                          class="w-full"
                          size="md"
                          disabled={joining()}
                          onClick={() => handleJoin(props.code)}
                        >
                          {joining() ? t('invite.joining') : t('invite.joinSpace')}
                        </Button>
                      }
                    >
                      <Button
                        class="w-full"
                        size="md"
                        onClick={() => navigate(`/spaces/${space.id}`)}
                      >
                        {t('invite.goToSpace')}
                      </Button>
                    </Show>
                  </div>
                </Show>
              </div>
            </>
          );
        }}
      </Show>
    </div>
  );
};
