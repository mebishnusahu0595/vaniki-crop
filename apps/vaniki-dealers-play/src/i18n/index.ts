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
          freeDelivery: 'Free delivery on orders above Rs. {{amount}}',
          call: 'Call',
        },
        tabs: {
          home: 'Home',
          selectCrop: 'Select Crop',
          categories: 'Categories',
          agriAdvisor: 'Agri Advisor',
          compare: 'Compare',
          cart: 'Cart',
          account: 'Account',
        },
        header: {
          searchPlaceholder: 'Search pesticides, nutrients, and crop care',
        },
        sidebar: {
          editProfile: 'Edit Profile',
          language: 'Language',
          wishlist: 'Wishlist',
          myFarm: 'My Farm',
          myOrders: 'My Orders',
          referEarn: 'Refer & Earn',
          contactUs: 'Contact Us',
          aboutUs: 'About Us',
          termsConditions: 'Terms & Conditions',
          signOut: 'Sign Out',
          signInRegister: 'Sign In / Register',
          guestUser: 'Guest User',
          loginToManage: 'Login to manage your account',
        },
        selectCropPage: {
          title: 'Select Crop',
          sub: 'Personalized crop protection & fertilizer recommendation engine',
          comingSoon: 'Coming Soon!',
          desc: 'We are working on bringing automated crop-specific disease diagnostic tools and tailored spray schedules for Wheat, Rice, Soybean, Tomato, and Cotton growers.',
          launching: 'Launching In Next Update 🚀',
        },
        agriAdvisorPage: {
          title: 'Agri Advisor',
          sub: 'Free Expert Consultation for Crop Disease & Fertilizer Management',
          callExpert: 'Call Agri Expert',
          whatsappSupport: 'WhatsApp Crop Support',
          sendPhoto: 'Send photo of diseased leaf or crop',
        },
        actions: {
          addToCart: 'Add to Cart',
          outOfStock: 'Out of Stock',
          addToWishlist: 'Add to Wishlist',
          removeFromWishlist: 'Remove from Wishlist',
          addToCompare: 'Add to Compare',
          removeFromCompare: 'Remove from Compare',
          onlyLeft: 'Only {{count}} left',
          insufficientStock: 'Only {{count}} units available in this store',
          unitsAvailable: '{{count}} units available',
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
          pickup: 'Store',
          from: 'From',
          deliveringTo: 'Delivering To',
          pickupFrom: 'Store',
          chooseStore: 'Choose Store',
          addAddress: 'Add Address',
          change: 'Change',
          searchStore: 'Search by city, area, store or pincode',
          getDirections: 'Get directions',
          selectStore: 'Select Store',
          noStores: 'No stores available right now.',
        },
      },
    },
  },
  hi: {
    translation: {
      mobile: {
        topNotice: {
          freeDelivery: 'Rs. {{amount}} से ऊपर ऑर्डर पर फ्री डिलीवरी',
          call: 'कॉल',
        },
        tabs: {
          home: 'होम',
          selectCrop: 'फसल चुनें',
          categories: 'श्रेणियां',
          agriAdvisor: 'कृषि सलाहकार',
          compare: 'तुलना',
          cart: 'कार्ट',
          account: 'अकाउंट',
        },
        header: {
          searchPlaceholder: 'कीटनाशक, पोषक तत्व और फसल देखभाल खोजें',
        },
        sidebar: {
          editProfile: 'प्रोफाइल एडिट करें',
          language: 'भाषा बदलें',
          wishlist: 'विशलिस्ट',
          myFarm: 'मेरा खेत',
          myOrders: 'मेरे ऑर्डर्स',
          referEarn: 'रेफर करें और कमाएं',
          contactUs: 'संपर्क करें',
          aboutUs: 'हमारे बारे में',
          termsConditions: 'नियम एवं शर्तें',
          signOut: 'साइन आउट',
          signInRegister: 'साइन इन / रजिस्टर करें',
          guestUser: 'अतिथि उपयोगकर्ता',
          loginToManage: 'अपने अकाउंट के लिए लॉगिन करें',
        },
        selectCropPage: {
          title: 'फसल चुनें',
          sub: 'व्यक्तिगत फसल सुरक्षा और उर्वरक सिफारिशें',
          comingSoon: 'जल्द ही आ रहा है!',
          desc: 'हम गेहूं, धान, सोयाबीन, टमाटर और कपास किसानों के लिए स्वचालित रोग निदान उपकरण और स्प्रे शेड्यूल ला रहे हैं।',
          launching: 'अगले अपडेट में लॉन्च हो रहा है 🚀',
        },
        agriAdvisorPage: {
          title: 'कृषि सलाहकार',
          sub: 'फसल रोग और उर्वरक प्रबंधन के लिए मुफ्त विशेषज्ञ सलाह',
          callExpert: 'कृषि विशेषज्ञ को कॉल करें',
          whatsappSupport: 'व्हाट्सऐप फसल सहायता',
          sendPhoto: 'रोगग्रस्त पत्ती या फसल की फोटो भेजें',
        },
        actions: {
          addToCart: 'कार्ट में जोड़ें',
          outOfStock: 'स्टॉक खत्म',
          addToWishlist: 'विशलिस्ट में जोड़ें',
          removeFromWishlist: 'विशलिस्ट से हटाएं',
          addToCompare: 'तुलना में जोड़ें',
          removeFromCompare: 'तुलना से हटाएं',
          onlyLeft: 'केवल {{count}} बचे हैं',
          insufficientStock: 'इस स्टोर में केवल {{count}} यूनिट उपलब्ध हैं',
          unitsAvailable: '{{count}} यूनिट उपलब्ध हैं',
        },
        home: {
          title: 'फसल देखभाल अब स्थानीय, तेज और भरोसेमंद।',
          categories: 'श्रेणियां',
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
          pickup: 'स्टोर',
          from: 'यहां से',
          deliveringTo: 'डिलीवरी पता',
          pickupFrom: 'स्टोर',
          chooseStore: 'स्टोर चुनें',
          addAddress: 'पता जोड़ें',
          change: 'बदलें',
          searchStore: 'शहर, क्षेत्र, स्टोर या पिनकोड से खोजें',
          getDirections: 'दिशा-निर्देश',
          selectStore: 'स्टोर चुनें',
          noStores: 'अभी कोई स्टोर उपलब्ध नहीं है।',
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