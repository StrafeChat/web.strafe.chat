import './index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { TransProvider } from '@mbarzda/solid-i18next';
import { ThemeEditorDialog } from './components/settings/ThemeEditorDialog';
import { BUILTIN_THEMES } from './theme/themes';
import { initAppearance } from './stores/appearance';
import en from './i18n/locales/en';
import { applyDocumentLangDir, getInitialLanguage } from './i18n/config';
import { bindI18nReactivity } from './i18n/t';

const initialLng = getInitialLanguage();
applyDocumentLangDir(initialLng);
bindI18nReactivity();
initAppearance();

render(
  () => (
    <TransProvider
      lng={initialLng}
      options={{
        resources: { en: { translation: en } },
        fallbackLng: 'en',
        supportedLngs: ['en'],
        interpolation: { escapeValue: false },
      }}
    >
      <ThemeEditorDialog open base={BUILTIN_THEMES[0]!} onClose={() => undefined} />
    </TransProvider>
  ),
  document.getElementById('root')!
);
