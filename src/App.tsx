import { ThemeProvider } from "./lib/providers/theme/ThemeProvider";
import { ContextMenuProvider } from "./lib/providers/context/ContextMenuProvider";
import { AuthProvider } from "./lib/providers/auth/AuthProvider";
import { CacheProvider } from "./lib/providers/cache/CacheProvider";
import { TransProvider } from "@mbarzda/solid-i18next";
import { Router, Route } from "@solidjs/router";
import en from "./locales/list/en-us.json";
import es from "./locales/list/es-es.json";
import fr from "./locales/list/fr-fr.json";
import ar from "./locales/list/ar-sa.json";
import { ParentProps, createEffect, lazy } from "solid-js";
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import { Interface } from "./components/shared/Interface";
import { Home } from "./components/home/Home";
import { Friends } from "./components/home/friends/Friends";
import { Notes } from "./components/home/notes/Notes";
import { getDirection } from "./lib/utils/direction";
import { applyCustomStyles } from "./lib/utils/customStyles";
import { ToastProvider } from "./components/common/Toast";
import { SettingsProvider } from "./lib/providers/settings/SettingsProvider";
import { UserSettingsProvider } from "./lib/providers/userSettings/UserSettingsProvider";
import RoomView from "./components/chat/RoomView";
import { ModalProvider } from "./lib/providers/modal/ModalProvider";
import LinkConfirmationHandler from "./components/LinkConfirmationHandler";

const MountApp = (props: ParentProps) => {
  const savedLang = localStorage.getItem("sc_lang") || "en_us";

  createEffect(() => {
    // Set language and direction
    document.documentElement.dir = getDirection(savedLang);
    document.documentElement.lang = savedLang.split("_")[0];

    // Apply custom styles
    applyCustomStyles();
  });

  return (
    <TransProvider
      options={{
        fallbackLng: "en_us",
        lng: savedLang,
        resources: {
          en_us: { translation: en },
          es_es: { translation: es },
          fr_fr: { translation: fr },
          ar_sa: { translation: ar },
        },
      }}
    >
      <ThemeProvider>
        <ToastProvider>
          <ContextMenuProvider>
            <CacheProvider>
              <AuthProvider>
                <SettingsProvider>
                  <UserSettingsProvider>
                    <ModalProvider>
                      <LinkConfirmationHandler />
                      <div class="h-[100dvh] w-full overflow-hidden">{props.children}</div>
                    </ModalProvider>
                  </UserSettingsProvider>
                </SettingsProvider>
              </AuthProvider>
            </CacheProvider>
          </ContextMenuProvider>
        </ToastProvider>
      </ThemeProvider>
    </TransProvider>
  );
};

const App = () => {
  // We're using the LinkConfirmationHandler component
  // which handles all link clicks in the application

  return (
    <MountApp>
      <Router>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/password-reset" component={lazy(() => import('./components/auth/PasswordReset'))} />
        <Route path="/password-reset/verify" component={lazy(() => import('./components/auth/PasswordResetVerify'))} />
        <Route path="/password-reset/complete" component={lazy(() => import('./components/auth/PasswordResetComplete'))} />
        <Route path="/" component={Interface as never}>
          <Route path="/" component={Home} />
          <Route path="/friends" component={Friends} />
          <Route path="/notes" component={Notes} />
          <Route path="/rooms/:roomId" component={RoomView} />
        </Route>
      </Router>
    </MountApp>
  );
};

export default App;
