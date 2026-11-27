import { onMount } from 'solid-js';
import { Show } from 'solid-js';
import { Router, Route, Navigate, A, useNavigate, useSearchParams } from '@solidjs/router';
import { authGlassSurface } from '../components/auth/authLayout';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Main from '../pages/Main';
import HomePage from '../pages/HomePage';
import FriendsPage from '../pages/FriendsPage';
import NotesPage from '../pages/NotesPage';
import DiscoverPage from '../pages/DiscoverPage';
import SpacePage from '../pages/SpacePage';
import RoomPage from '../pages/RoomPage';
import MessageLinkPage from '../pages/MessageLinkPage';
import InvitePage from '../pages/InvitePage';
import AdminPage from '../pages/AdminPage';
import OAuthAuthorizePage from '../pages/OAuthAuthorizePage';
import VerifyEmailPage from '../pages/VerifyEmailPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import ConfirmEmailPage from '../pages/ConfirmEmailPage';
import PublicProfilePage from '../pages/PublicProfilePage';
import { setConnectionsCallback } from '../stores/connections';
import { openUserSettings } from '../stores/userSettingsModal';
import { StargateProvider } from '../components/StargateProvider';
import { ConnectionStatusBanner } from '../components/ConnectionStatusBanner';
import { UpdateAvailableBanner } from '../components/UpdateAvailableBanner';
import { initUpdateCheck } from '../stores/updateAvailable';
import { RecoveryModal } from '../components/RecoveryModal';
import { E2eeEnvironmentModal } from '../components/E2eeEnvironmentModal';
import { ExternalLinkModal } from '../components/ExternalLinkModal';
import { UserSettingsModal } from '../components/UserSettingsModal';
import { SafetyNumberModal } from '../components/SafetyNumberModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PasswordPromptHost } from '../components/PasswordPromptHost';
import { auth, hydrateAuth } from '../stores/auth';
import { AppBackground } from '../components/auth/AppBackground';
import { isDesktop } from '../desktop/env';
import { DesktopTitleBar } from '../components/desktop/TitleBar';
import { DesktopUpdateBanner } from '../components/desktop/DesktopUpdateBanner';
import { t } from '../i18n';

function LoadingScreen() {
  return (
    <div class="min-h-dvh bg-background text-foreground flex items-center justify-center">
      <div class="flex flex-col items-center gap-4">
        <span class="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p class="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    </div>
  );
}

function NotFound() {
  // `relative z-10`: the app background is a fixed z-0 layer, so an unpositioned page
  // would paint underneath it and appear blank.
  return (
    <div class="relative z-10 flex min-h-dvh items-center justify-center p-4 text-foreground">
      <div class={`w-full max-w-sm p-8 text-center ${authGlassSurface}`}>
        <p class="font-brand text-5xl font-extrabold tracking-tight text-primary">404</p>
        <h1 class="mt-2 text-lg font-semibold text-foreground">{t('notFound.title')}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{t('notFound.body')}</p>
        <A
          href="/"
          class="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
        >
          {t('invite.goHome')}
        </A>
      </div>
    </div>
  );
}

function RootLayout(props: { children?: import('solid-js').JSX.Element }) {
  onMount(() => hydrateAuth());
  // The web client polls for a new deploy; the desktop app updates through its shell.
  onMount(() => {
    if (!isDesktop()) initUpdateCheck();
  });
  return (
    <>
      <Show when={isDesktop()}>
        <DesktopTitleBar />
      </Show>
      <StargateProvider>
      <Show when={auth.hydrated} fallback={<LoadingScreen />}>
        <AppBackground />
        <ConnectionStatusBanner />
        <Show when={!isDesktop()} fallback={<DesktopUpdateBanner />}>
          <UpdateAvailableBanner />
        </Show>
        {props.children}
        <RecoveryModal />
        <E2eeEnvironmentModal />
        <ExternalLinkModal />
        <UserSettingsModal />
        <SafetyNumberModal />
        <ConfirmDialog />
        <PasswordPromptHost />
      </Show>
      </StargateProvider>
    </>
  );
}

// A tracked <Show>, not an early return - see ProtectedRoute for why: an `if` here ran once
// at mount, so signing out (or a session expiring) never sent the user back to /login.
function Home(props: { children?: import('solid-js').JSX.Element }) {
  return (
    <Show when={auth.token} fallback={<Navigate href="/login" />}>
      <Main>{props.children}</Main>
    </Show>
  );
}

/**
 * Where a connection's sign-in (GitHub, Discord, Bluesky) comes back to: /settings/connections
 * ?connected=<provider> or ?error=<code>. It hands the result to the settings page, opens
 * Settings on Connections and replaces itself with the home page.
 */
function ConnectionsLanding() {
  const [params] = useSearchParams<{ connected?: string; error?: string }>();
  const navigate = useNavigate();
  onMount(() => {
    const connected = typeof params.connected === 'string' ? params.connected : undefined;
    const error = typeof params.error === 'string' ? params.error : undefined;
    setConnectionsCallback({ ...(connected ? { connected } : {}), ...(error ? { error } : {}) });
    openUserSettings('connections');
    navigate('/', { replace: true });
  });
  return null;
}

/** A public page's address: /@username. */
const PUBLIC_HANDLE = /^@[A-Za-z0-9_.-]{1,64}$/;

const SNOWFLAKE = /^\d{1,20}$/;
const messageLinkFilters = { roomId: SNOWFLAKE, messageId: SNOWFLAKE };

export function AppRouter() {
  return (
    <Router root={RootLayout}>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      {/* Where the links in emails land. Top-level, not under Home: the person may well be
          signed out, or in a different browser than the one they registered in. */}
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      {/* The link sent to a new address; it asks the visitor to sign in first if needed. */}
      <Route path="/confirm-email" component={ConfirmEmailPage} />
      <Route path="/" component={Home}>
        <Route path="/" component={HomePage} />
        <Route path="/friends" component={FriendsPage} />
        <Route path="/notes" component={NotesPage} />
        <Route path="/discover" component={DiscoverPage} />
        <Route path="/settings/connections" component={ConnectionsLanding} />
        <Route path="/rooms/:roomId" component={RoomPage} />
        <Route path="/spaces/:spaceId" component={SpacePage} />
        <Route path="/spaces/:spaceId/rooms/:roomId" component={SpacePage} />
        {/* A message link (lib/roomLinks.ts) opened in a tab of its own: opens the room and
            jumps to the message, then replaces itself with the room's address. */}
        <Route path="/rooms/:roomId/:messageId" component={MessageLinkPage} matchFilters={messageLinkFilters} />
        <Route
          path="/spaces/:spaceId/rooms/:roomId/:messageId"
          component={MessageLinkPage}
          matchFilters={messageLinkFilters}
        />
      </Route>
      <Route path="/invite/:code" component={InvitePage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/oauth2/authorize" component={OAuthAuthorizePage} />
      {/* A person's public page (Settings > Connections), readable signed out. */}
      <Route path="/:handle" component={PublicProfilePage} matchFilters={{ handle: PUBLIC_HANDLE }} />
      <Route path="*404" component={NotFound} />
    </Router>
  );
}
