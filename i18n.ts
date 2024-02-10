import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';

i18n
  .use(initReactI18next)
  .use(HttpApi)
  .init({
    supportedLngs: ['af_ZA', 'en_US', 'fr_FR', 'nl_NL', 'bn_BD'],
    fallbackLng: 'en_US',
    backend: {
      loadPath: '/locales/{{lng}}.json',
    },
  });

export default i18n;