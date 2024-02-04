import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';

i18n
  .use(initReactI18next)
  .use(HttpApi)
  .init({
    supportedLngs: ['en_US', 'fr_FR'],
    fallbackLng: 'en_US',
    detection: {
      order: ['localStorage', 'navigator'],
    },
    backend: {
      loadPath: '/locales/{{lng}}.json',
    },
  });

export default i18n;