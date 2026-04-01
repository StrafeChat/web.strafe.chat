/* @refresh reload */
import './index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { render } from 'solid-js/web';
import { TransProvider } from '@mbarzda/solid-i18next';
import 'solid-devtools';

import App from './App';
import en from './i18n/locales/en';
import es from './i18n/locales/es';
import ar from './i18n/locales/ar';
import { applyDocumentLangDir, getInitialLanguage } from './i18n/config';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

const initialLng = getInitialLanguage();
applyDocumentLangDir(initialLng);

const i18nResources = {
  en: { translation: en },
  es: { translation: es },
  ar: { translation: ar },
};

render(
  () => (
    <TransProvider
      lng={initialLng}
      options={{
        resources: i18nResources,
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
      }}
    >
      <App />
    </TransProvider>
  ),
  root!,
);
