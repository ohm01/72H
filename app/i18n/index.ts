import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import cs from './locales/cs.json';
import en from './locales/en.json';

// To add a language: create locales/<code>.json and register it here.
export const resources = {
  cs: { translation: cs },
  en: { translation: en },
} as const;

export type Language = keyof typeof resources;
export const fallbackLanguage: Language = 'en';

function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code && code in resources ? (code as Language) : fallbackLanguage;
}

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: fallbackLanguage,
  interpolation: { escapeValue: false }, // React already escapes
});

export default i18n;
