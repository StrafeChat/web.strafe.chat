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
import { ParentProps, createEffect } from "solid-js";
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import { Interface } from "./components/shared/Interface";
import { Home } from "./components/home/Home";
import { Friends } from "./components/home/friends/Friends";
import { Notes } from "./components/home/notes/Notes";
import { getDirection } from "./lib/utils/direction";

const MountApp = (props: ParentProps) => {
  const savedLang = localStorage.getItem("sc_lang") || "en_us";

  createEffect(() => {
    document.documentElement.dir = getDirection(savedLang);
    document.documentElement.lang = savedLang.split("_")[0];
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
        <ContextMenuProvider>
          <CacheProvider>
            <AuthProvider>
              <div class="h-screen w-screen">{props.children}</div>
            </AuthProvider>
          </CacheProvider>
        </ContextMenuProvider>
      </ThemeProvider>
    </TransProvider>
  );
};

const App = () => {
  return (
    <MountApp>
      <Router>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/" component={Interface as never}>
          <Route path="/" component={Home} />
          <Route path="/friends" component={Friends} />
          <Route path="/notes" component={Notes} />
        </Route>
      </Router>
    </MountApp>
  );
};

export default App;
