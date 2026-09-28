import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { auth } from '../stores/auth';
import { appPageHeader, appPageTitle } from '../theme/appChrome';
import { authGlassSurface } from '../components/auth/authLayout';
import { Button } from '../components/ui/Button';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { CreateSpaceModal } from '../components/CreateSpaceModal';
import { t } from '../i18n';

function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'home.greetingMorning';
  if (hour >= 12 && hour < 17) return 'home.greetingAfternoon';
  if (hour >= 17 && hour < 21) return 'home.greetingEvening';
  return 'home.greetingNight';
}

const HomePage: Component = () => {
  const navigate = useNavigate();
  const name = () => auth.user?.display_name || auth.user?.username || t('home.there');
  const [createGroupOpen, setCreateGroupOpen] = createSignal(false);
  const [createSpaceOpen, setCreateSpaceOpen] = createSignal(false);

  return (
    <div class="flex flex-1 flex-col">
      <div class={`${appPageHeader} gap-2`}>
        <i class="fa-solid fa-house shrink-0 text-muted-foreground" aria-hidden="true" />
        <h1 class={appPageTitle}>{t('nav.home')}</h1>
      </div>
      <div class="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        <div class={`w-full max-w-lg p-8 text-center sm:p-10 ${authGlassSurface}`}>
          <div class="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <i class="fa-solid fa-shield-halved text-2xl" aria-hidden="true" />
          </div>
          <h2 class="mb-2 text-3xl font-bold tracking-tight text-foreground">
            {t('home.greeting', { greeting: t(greetingKey()), name: name() })}
          </h2>
          <p class="mb-8 text-base leading-relaxed text-muted-foreground">{t('home.welcome')}</p>
          <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Button class="whitespace-nowrap px-5 font-semibold" onClick={() => navigate('/friends')}>
              <i class="fa-solid fa-user-plus text-xs" aria-hidden="true" />
              {t('home.addFriends')}
            </Button>
            <Button variant="outline" class="whitespace-nowrap px-5" onClick={() => setCreateGroupOpen(true)}>
              <i class="fa-solid fa-comments text-xs" aria-hidden="true" />
              {t('home.startGroup')}
            </Button>
            <Button variant="outline" class="whitespace-nowrap px-5" onClick={() => setCreateSpaceOpen(true)}>
              <i class="fa-solid fa-plus text-xs" aria-hidden="true" />
              {t('home.createSpace')}
            </Button>
          </div>
        </div>
      </div>
      <CreateGroupModal open={createGroupOpen()} onClose={() => setCreateGroupOpen(false)} />
      <CreateSpaceModal open={createSpaceOpen()} onClose={() => setCreateSpaceOpen(false)} />
    </div>
  );
};

export default HomePage;
