import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { tr } from './locales/tr';

export const LOCALE_STORAGE_KEY = '@synapse/locale_v1';

export type AppLocale = 'en' | 'tr';

let initPromise: Promise<typeof i18n> | null = null;

function deviceLocale(): AppLocale {
  const tag = Localization.getLocales()[0]?.languageTag ?? 'en';
  return tag.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export async function initI18n(): Promise<typeof i18n> {
  if (!initPromise) {
    initPromise = (async () => {
      let lng: AppLocale = deviceLocale();
      try {
        const saved = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
        if (saved === 'en' || saved === 'tr') lng = saved;
      } catch {
        /* ignore */
      }

      await i18n.use(initReactI18next).init({
        compatibilityJSON: 'v4',
        resources: {
          en: { translation: en },
          tr: { translation: tr },
        },
        lng,
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
        react: { useSuspense: false },
      });
      return i18n;
    })();
  }
  return initPromise;
}

export async function setAppLanguage(lng: AppLocale): Promise<void> {
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, lng);
  await i18n.changeLanguage(lng);
}

export default i18n;
