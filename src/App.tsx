import { ThemeProvider } from "./lib/providers/theme/ThemeProvider";
import { ContextMenuProvider } from "./lib/providers/context/ContextMenuProvider";
import { AuthProvider } from "./lib/providers/auth/AuthProvider";
import { CacheProvider } from "./lib/providers/cache/CacheProvider";
import { MobileNavProvider } from "./lib/providers/mobile/MobileNavProvider";
import { TransProvider } from "@mbarzda/solid-i18next";
import { Router, Route } from "@solidjs/router";
import en from "./locales/list/en-us.json";
import es from "./locales/list/es-es.json";
import fr from "./locales/list/fr-fr.json";
import ar from "./locales/list/ar-sa.json";
import { ParentProps, createEffect, lazy } from "solid-js";
import { Interface } from "./components/shared/Interface";
import { getDirection } from "./lib/utils/direction";
import { applyCustomStyles } from "./lib/utils/customStyles";
import { ToastProvider } from "./components/common/Toast";
import { SettingsProvider } from "./lib/providers/settings/SettingsProvider";
import { UserSettingsProvider } from "./lib/providers/userSettings/UserSettingsProvider";
import { ModalProvider } from "./lib/providers/modal/ModalProvider";
import LinkConfirmationHandler from "./components/LinkConfirmationHandler";
import UpdateNotificationModal from "./components/modals/UpdateNotificationModal";
import { useUpdateNotification } from "./lib/hooks/useUpdateNotification";
// Import test utilities for development
import "./lib/utils/updateTestUtils";

const MountApp = (props: ParentProps) => {
  const savedLang = localStorage.getItem("sc_lang") || "en_us";
  const {
    updateInfo,
    isModalOpen,
    handleModalClose
  } = useUpdateNotification();

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
              <UserSettingsProvider>
                <AuthProvider>
                  <MobileNavProvider>
                    <SettingsProvider>
                      <ModalProvider>
                        <LinkConfirmationHandler />
                        <UpdateNotificationModal
                          isOpen={isModalOpen()}
                          onClose={handleModalClose}
                          updateInfo={updateInfo()}
                        />
                        <div class="h-[100dvh] w-full overflow-hidden">{props.children}</div>
                      </ModalProvider>
                    </SettingsProvider>
                  </MobileNavProvider>
                </AuthProvider>
              </UserSettingsProvider>
            </CacheProvider>
          </ContextMenuProvider>
        </ToastProvider>
      </ThemeProvider>
    </TransProvider>
  );
};

const App = () => {

  return (
    <MountApp>
      <Router>
        <Route path="/login" component={lazy(() => import('./components/auth/Login'))} />
        <Route path="/register" component={lazy(() => import('./components/auth/Register'))} />
        <Route path="/verify-email" component={lazy(() => import('./components/auth/EmailVerify'))} />
        <Route path="/password-reset" component={lazy(() => import('./components/auth/PasswordReset'))} />
        <Route path="/password-reset/verify" component={lazy(() => import('./components/auth/PasswordResetVerify'))} />
        <Route path="/password-reset/complete" component={lazy(() => import('./components/auth/PasswordResetComplete'))} />
        <Route path="/" component={Interface as never}>
          <Route path="/" component={lazy(() => import('./components/home/Home'))} />
          <Route path="/friends" component={lazy(() => import('./components/home/friends/Friends'))} />
          <Route path="/notes" component={lazy(() => import('./components/home/notes/Notes'))} />
          <Route path="/rooms/:roomId" component={lazy(() => import('./components/chat/RoomView'))} />
        </Route>
      </Router>
    </MountApp>
  );
};

export default App;
