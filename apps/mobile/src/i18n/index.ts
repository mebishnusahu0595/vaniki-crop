import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { asyncStorage } from '../lib/storage';

export type AppLanguage = 'en' | 'hi';

const LANGUAGE_STORAGE_KEY = 'vaniki-language';

const resources = {
  en: {
    translation: {
      mobile: {
        topNotice: {
          freeDelivery: 'Free delivery on orders above Rs. 1,000',
          call: 'Call',
        },
        tabs: {
          home: 'Home',
          categories: 'Categories',
          compare: 'Compare',
          cart: 'Cart',
          account: 'Account',
        },
        header: {
          searchPlaceholder: 'Search pesticides, nutrients, and crop care',
        },
        actions: {
          addToCart: 'Add to Cart',
          outOfStock: 'Out of Stock',
          addToWishlist: 'Add to Wishlist',
          removeFromWishlist: 'Remove from Wishlist',
          addToCompare: 'Add to Compare',
          removeFromCompare: 'Remove from Compare',
        },
        home: {
          title: 'Crop care made local, fast, and reliable.',
          categories: 'Categories',
          viewAll: 'View All',
          bestDeals: 'Best Deals',
          bestSellers: 'Best Sellers',
          whatFarmersSay: 'What Farmers Say',
        },
        whatsapp: {
          defaultMessage: 'Hello Vaniki Crop, I need help',
          openChat: 'Open WhatsApp chat',
        },
        serviceMode: {
          delivery: 'Delivery',
          pickup: 'Pickup',
          from: 'From',
          deliveringTo: 'Delivering To',
          pickupFrom: 'Pickup From',
          chooseStore: 'Choose Store',
          addAddress: 'Add Address',
          change: 'Change',
        },
      },
    },
  },
  hi: {
    translation: {
      mobile: {
        topNotice: {
          freeDelivery: 'Rs. 1,000 से ऊपर ऑर्डर पर फ्री डिलीवरी',
          call: 'कॉल',
        },
        tabs: {
          home: 'होम',
          categories: 'कैटेगरी',
          compare: 'तुलना',
          cart: 'कार्ट',
          account: 'अकाउंट',
        },
        header: {
          searchPlaceholder: 'कीटनाशक, पोषक तत्व और फसल देखभाल खोजें',
        },
        actions: {
          addToCart: 'कार्ट में जोड़ें',
          outOfStock: 'स्टॉक खत्म',
          addToWishlist: 'विशलिस्ट में जोड़ें',
          removeFromWishlist: 'विशलिस्ट से हटाएं',
          addToCompare: 'तुलना में जोड़ें',
          removeFromCompare: 'तुलना से हटाएं',
        },
        home: {
          title: 'फसल देखभाल अब स्थानीय, तेज और भरोसेमंद।',
          categories: 'कैटेगरी',
          viewAll: 'सब देखें',
          bestDeals: 'बेहतरीन डील्स',
          bestSellers: 'सबसे ज्यादा बिकने वाले',
          whatFarmersSay: 'किसान क्या कहते हैं',
        },
        whatsapp: {
          defaultMessage: 'नमस्ते Vaniki Crop, मुझे सहायता चाहिए',
          openChat: 'व्हाट्सऐप चैट खोलें',
        },
        serviceMode: {
          delivery: 'डिलीवरी',
          pickup: 'पिकअप',
          from: 'यहां से',
          deliveringTo: 'डिलीवरी पता',
          pickupFrom: 'पिकअप स्टोर',
          chooseStore: 'स्टोर चुनें',
          addAddress: 'पता जोड़ें',
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