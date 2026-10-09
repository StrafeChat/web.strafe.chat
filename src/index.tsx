/* @refresh reload */
import './index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { render } from 'solid-js/web';
import { TransProvider } from '@mbarzda/solid-i18next';
import 'solid-devtools';

import App from './App';
import en from './i18n/locales/en';
import es from './i18n/locales/es';
import ptBR from './i18n/locales/pt-BR';
import fr from './i18n/locales/fr';
import de from './i18n/locales/de';
import ar from './i18n/locales/ar';
import { applyDocumentLangDir, getInitialLanguage } from './i18n/config';
import { bindI18nReactivity } from './i18n/t';
import { isDesktop } from './desktop/env';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

const initialLng = getInitialLanguage();
applyDocumentLangDir(initialLng);
bindI18nReactivity();

const i18nResources = {
  en: { translation: en },
  es: { translation: es },
  'pt-BR': { translation: ptBR },
  fr: { translation: fr },
  de: { translation: de },
  ar: { translation: ar },
};

render(
  () => (
    <TransProvider
      lng={initialLng}
      options={{
        resources: i18nResources,
        fallbackLng: 'en',
        supportedLngs: Object.keys(i18nResources),
        interpolation: { escapeValue: false },
      }}
    >
      <App />
    </TransProvider>
  ),
  root!,
);

// Deploy resilience (production only; tree-shaken out of dev).
if (import.meta.env.PROD) {
  // Service worker: kept only so the app stays installable - it caches no app code (see
  // public/sw.js), which is what stops a new deploy from breaking the client until site data
  // is cleared. When a new deploy activates a new worker and claims this page, reload once so
  // the tab runs the fresh build (guarded so a first install doesn't reload and it can't loop).
  // Not in the desktop app: it is installed already, and updates come through the shell.
  if ('serviceWorker' in navigator && !isDesktop()) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    });
  }

  // A failed dynamic import is almost always a stale tab whose code-split chunk a new deploy
  // replaced; reload once (rate-limited so it can't loop) to pick up the current build.
  window.addEventListener('vite:preloadError', () => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem('sw-preload-reload-at') || 0);
    } catch {
      /* private mode */
    }
    if (Date.now() - last > 10000) {
      try {
        sessionStorage.setItem('sw-preload-reload-at', String(Date.now()));
      } catch {
        /* private mode */
      }
      window.location.reload();
    }
  });
}
