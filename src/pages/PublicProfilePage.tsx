import { createResource, For, Show } from 'solid-js';
import { A, useParams } from '@solidjs/router';
import { getPublicProfile } from '../api/connections';
import { MessageAvatar } from '../components/messageList/MessageAvatar';
import { authGlassSurface, authPageOuter } from '../components/auth/authLayout';
import { AuthBrandMark } from '../components/auth/AuthBrandMark';
import { connectionIcon, connectionLabel } from '../lib/connections';
import { useReactiveTranslate } from '../i18n';

/**
 * The public page at <web>/@<username>: a person's name, avatar and the connections they show
 * to everyone, readable without signing in, when they turned it on (Settings > Connections).
 * It is what their fediverse profile links to. Links here are plain (rel="me noopener"): the
 * page is the person's own statement of who they are elsewhere.
 */
export default function PublicProfilePage() {
  const [t] = useReactiveTranslate();
  const params = useParams<{ handle: string }>();
  const username = () => (params.handle ?? '').replace(/^@/, '');
  const [profile] = createResource(username, async (name) => {
    try {
      return await getPublicProfile(name);
    } catch {
      return null;
    }
  });

  return (
    <div class={authPageOuter}>
      <div class={`${authGlassSurface} relative z-10 w-full max-w-sm space-y-5 p-6`} data-public-profile>
        <AuthBrandMark />
        <Show when={!profile.loading} fallback={<p class="text-center text-sm text-muted-foreground">{t('common.loading')}</p>}>
          <Show
            when={profile()}
            fallback={
              <div class="space-y-4 text-center">
                <p class="text-sm text-muted-foreground" data-public-profile-missing>
                  {t('connections.publicPage.notPublic')}
                </p>
                <A href="/" class="text-sm font-medium text-primary hover:underline">
                  {t('connections.publicPage.openStrafe')}
                </A>
              </div>
            }
          >
            {(p) => (
              <div class="space-y-5">
                <div class="flex flex-col items-center gap-2 text-center">
                  <MessageAvatar name={p().display_name || p().username} avatar={p().avatar} user={{ id: p().id }} class="size-20 text-2xl" />
                  <div>
                    <h1 class="text-lg font-semibold text-foreground">{p().display_name || p().username}</h1>
                    <p class="text-sm text-muted-foreground">@{p().username}</p>
                  </div>
                </div>
                <Show when={p().connections.length > 0}>
                  <ul class="space-y-1.5">
                    <For each={p().connections}>
                      {(c) => (
                        <li class="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                          <i class={`${connectionIcon(c.provider)} w-5 text-center text-base text-muted-foreground`} aria-hidden="true" />
                          <div class="min-w-0 flex-1">
                            <Show when={c.url} fallback={<p class="truncate text-sm font-medium text-foreground">{c.name}</p>}>
                              {(href) => (
                                <a href={href()} rel="me noopener" target="_blank" class="block truncate text-sm font-medium text-foreground hover:underline">
                                  {c.name}
                                </a>
                              )}
                            </Show>
                            <p class="truncate text-xs text-muted-foreground">
                              {connectionLabel(c.provider)}
                              <Show when={c.verified && c.verified_by}> · {t('connections.verifiedBy', { domain: c.verified_by ?? '' })}</Show>
                            </p>
                          </div>
                          <Show when={c.verified}>
                            <i class="fa-solid fa-circle-check text-sm text-primary" aria-label={t('connections.verified')} />
                          </Show>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
                <div class="text-center">
                  <A href="/" class="text-sm font-medium text-primary hover:underline">
                    {t('connections.publicPage.openStrafe')}
                  </A>
                </div>
              </div>
            )}
          </Show>
        </Show>
      </div>
    </div>
  );
}
