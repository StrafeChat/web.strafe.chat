import { onMount } from 'solid-js';
import { Show } from 'solid-js';
import { Router, Route, Navigate, useLocation } from '@solidjs/router';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Main from '../pages/Main';
import HomePage from '../pages/HomePage';
import FriendsPage from '../pages/FriendsPage';
import NotesPage from '../pages/NotesPage';
import SpacePage from '../pages/SpacePage';
import RoomPage from '../pages/RoomPage';
import InvitePage from '../pages/InvitePage';
import { StargateProvider } from '../components/StargateProvider';
import { RecoveryPinModal } from '../components/RecoveryPinModal';
import { E2eeEnvironmentModal } from '../components/E2eeEnvironmentModal';
import { ExternalLinkModal } from '../components/ExternalLinkModal';
import { UserSettingsModal } from '../components/UserSettingsModal';
import { auth, hydrateAuth } from '../stores/auth';
import { AuthTurtleBackground } from '../components/auth/AuthTurtleBackground';

function LoadingScreen() {
  return (
    <div class="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div class="flex flex-col items-center gap-4">
        <span class="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p class="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div class="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div class="text-center">
        <h1 class="text-2xl font-bold">404</h1>
        <p class="text-muted-foreground mt-2">Page not found</p>
        <a href="/" class="text-primary mt-4 inline-block underline">
          Go home
        </a>
      </div>
    </div>
  );
}

function RootLayout(props: { children?: import('solid-js').JSX.Element }) {
  onMount(() => hydrateAuth());
  const location = useLocation();
  const isAuthRoute = () => location.pathname === '/login' || location.pathname === '/register';
  return (
    <StargateProvider>
      <Show when={auth.hydrated} fallback={<LoadingScreen />}>
        <AuthTurtleBackground show={isAuthRoute()} />
        {props.children}
        <RecoveryPinModal />
        <E2eeEnvironmentModal />
        <ExternalLinkModal />
        <UserSettingsModal />
      </Show>
    </StargateProvider>
  );
}

function Home(props: { children?: import('solid-js').JSX.Element }) {
  if (!auth.token) return <Navigate href="/login" />;
  return <Main>{props.children}</Main>;
}

export function AppRouter() {
  return (
    <Router root={RootLayout}>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={Home}>
        <Route path="/" component={HomePage} />
        <Route path="/friends" component={FriendsPage} />
        <Route path="/notes" component={NotesPage} />
        <Route path="/rooms/:roomId" component={RoomPage} />
        <Route path="/spaces/:spaceId" component={SpacePage} />
        <Route path="/spaces/:spaceId/rooms/:roomId" component={SpacePage} />
      </Route>
      <Route path="/invite/:code" component={InvitePage} />
      <Route path="*404" component={NotFound} />
    </Router>
  );
}
