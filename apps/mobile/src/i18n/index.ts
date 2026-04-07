import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { asyncStorage } from '../lib/storage';

export type AppLanguage = 'en' | 'hi';

const LANGUAGE_STORAGE_KEY = 'vaniki-language';

const resources = {
  en: {
    translation: {
      mobile: {
        tabs: {
          home: 'Home',
          categories: 'Categories',
          cart: 'Cart',
          account: 'Account',
        },
        serviceMode: {
          delivery: 'Delivery',
          pickup: 'Pickup',
          from: 'From',
          chooseStore: 'Choose Store',
          change: 'Change',
        },
      },
    },
  },
  hi: {
    translation: {
      mobile: {
        tabs: {
          home: 'होम',
          categories: 'कैटेगरी',
          cart: 'कार्ट',
          account: 'अकाउंट',
        },
        serviceMode: {
          delivery: 'डिलीवरी',
          pickup: 'पिकअप',
          from: 'यहां से',
          chooseStore: 'स्टोर चुनें',
          change: 'बदलें',
        },
      },
    },
  },
};

const isSupportedLanguage = (value: string | null): value is AppLanguage => value === 'en' || value === 'hi';

export const getAppLanguage = (): AppLanguage =>
  i18n.resolvedLanguage?.toLowerCase().startsWith('hi') ? 'hi' : 'en';

export const getLanguageToggleLabel = (): string => (getAppLanguage() === 'hi' ? 'En' : 'हिंदी');

export const setAppLanguage = async (language: AppLanguage) => {
  await i18n.changeLanguage(language);
  await asyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
};

export const toggleAppLanguage = async () => {
  const nextLanguage: AppLanguage = getAppLanguage() === 'hi' ? 'en' : 'hi';
  await setAppLanguage(nextLanguage);
  return nextLanguage;
};

export const hydrateAppLanguage = async () => {
  const savedLanguage = await asyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isSupportedLanguage(savedLanguage)) {
    await i18n.changeLanguage(savedLanguage);
  }
};

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi'],
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;