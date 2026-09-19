import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDrawerStore } from '../store/useDrawerStore';
import { useAuthStore } from '../store/useAuthStore';
import { storefrontApi } from '../lib/api';
import { resolveMediaUrl } from '../utils/media';
import { setAppLanguage, getAppLanguage, type AppLanguage } from '../i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 330);

export function SidebarDrawer() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isHindi = (i18n.language || getAppLanguage()) === 'hi';
  const isOpen = useDrawerStore((state) => state.isOpen);
  const closeDrawer = useDrawerStore((state) => state.closeDrawer);
  const languageModalOpen = useDrawerStore((state) => state.languageModalOpen);
  const openLanguageModal = useDrawerStore((state) => state.openLanguageModal);
  const closeLanguageModal = useDrawerStore((state) => state.closeLanguageModal);

  const { user, setUser, logout } = useAuthStore();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [authModalItem, setAuthModalItem] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const currentLang = getAppLanguage();

  useEffect(() => {
    if (isOpen) {
      slideAnim.setValue(-DRAWER_WIDTH);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [isOpen, slideAnim]);

  const handleNavigate = (route: string, requiresAuth = false, label = '') => {
    if (!user && requiresAuth) {
      setAuthModalItem(label);
      return;
    }
    closeDrawer();
    router.push(route as any);
  };

  const handlePickImage = async () => {
    if (!user) {
      setAuthModalItem(t('mobile.sidebar.editProfile'));
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          isHindi ? 'अनुमति चाहिए' : 'Permission Required',
          isHindi
            ? 'गैलरी से फोटो चुनने के लिए कृपया अनुमति दें।'
            : 'Please grant access to your photo library.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setUploadingImage(true);
        const updatedUser = await storefrontApi.uploadProfileImage(result.assets[0].uri);
        setUser(updatedUser);
        Alert.alert(
          isHindi ? 'सफल' : 'Success',
          isHindi ? 'आपकी प्रोफ़ाइल फोटो सफलतापूर्वक अपडेट हो गई!' : 'Profile photo updated successfully!',
        );
      }
    } catch (err: any) {
      Alert.alert(
        isHindi ? 'त्रुटि' : 'Error',
        err?.message || (isHindi ? 'फोटो अपलोड करने में समस्या आई' : 'Failed to upload photo'),
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const menuItems = [
    {
      id: 'edit-profile',
      label: t('mobile.sidebar.editProfile'),
      subtitle: isHindi ? 'नाम, पता व किसान प्रोफाइल' : 'Name, address & details',
      icon: 'edit-3' as const,
      color: '#059669',
      bgColor: '#D1FAE5',
      requiresAuth: true,
      action: () => handleNavigate('/account/profile', true, t('mobile.sidebar.editProfile')),
    },
    {
      id: 'language',
      label: t('mobile.sidebar.language'),
      subtitle: currentLang === 'hi' ? 'हिंदी (चुना हुआ)' : 'English (Selected)',
      icon: 'globe' as const,
      color: '#0284C7',
      bgColor: '#E0F2FE',
      requiresAuth: false,
      action: () => openLanguageModal(),
    },
    {
      id: 'wishlist',
      label: t('mobile.sidebar.wishlist'),
      subtitle: isHindi ? 'सेव की गई दवाइयां' : 'Saved items for later',
      icon: 'heart' as const,
      color: '#E11D48',
      bgColor: '#FFE4E6',
      requiresAuth: true,
      action: () => handleNavigate('/account/wishlist', true, t('mobile.sidebar.wishlist')),
    },
    {
      id: 'my-farm',
      label: t('mobile.sidebar.myFarm'),
      subtitle: isHindi ? 'फसल सुरक्षा व स्प्रे शेड्यूल' : 'Crops & safety guides',
      icon: 'sun' as const,
      color: '#D97706',
      bgColor: '#FEF3C7',
      requiresAuth: false,
      action: () => handleNavigate('/(tabs)/select-crop', false, t('mobile.sidebar.myFarm')),
    },
    {
      id: 'my-orders',
      label: t('mobile.sidebar.myOrders'),
      subtitle: isHindi ? 'ऑर्डर ट्रैकिंग व इनवॉइस' : 'Track orders & invoices',
      icon: 'shopping-bag' as const,
      color: '#4F46E5',
      bgColor: '#EEF2FF',
      requiresAuth: true,
      action: () => handleNavigate('/account/orders', true, t('mobile.sidebar.myOrders')),
    },
    {
      id: 'refer-earn',
      label: t('mobile.sidebar.referEarn'),
      subtitle: isHindi ? 'मित्रों को जोड़ें, सिक्के कमाएं' : 'Earn coins & get discounts',
      icon: 'award' as const,
      color: '#B45309',
      bgColor: '#FDE68A',
      requiresAuth: true,
      action: () => handleNavigate('/account/loyalty', true, t('mobile.sidebar.referEarn')),
    },
    {
      id: 'contact-us',
      label: t('mobile.sidebar.contactUs'),
      subtitle: '9407963966',
      icon: 'phone' as const,
      color: '#0891B2',
      bgColor: '#CFFAFE',
      requiresAuth: false,
      action: () => handleNavigate('/contact'),
    },
    {
      id: 'about-us',
      label: t('mobile.sidebar.aboutUs'),
      subtitle: isHindi ? 'कंपनी और मिशन' : 'About Vaniki Crop',
      icon: 'info' as const,
      color: '#7C3AED',
      bgColor: '#EDE9FE',
      requiresAuth: false,
      action: () => handleNavigate('/about'),
    },
    {
      id: 'privacy',
      label: t('mobile.sidebar.termsConditions'),
      subtitle: isHindi ? 'गोपनीयता नीति' : 'Terms of service & privacy',
      icon: 'file-text' as const,
      color: '#475569',
      bgColor: '#F1F5F9',
      requiresAuth: false,
      action: () => handleNavigate('/privacy-policy'),
    },
  ];

  const handleLanguageSelect = async (lang: AppLanguage) => {
    await setAppLanguage(lang);
    closeLanguageModal();
  };

  const topHeaderPadding = Math.max(insets.top, 24) + 16;
  const userAvatarUrl = user?.profileImage?.url
    ? resolveMediaUrl(user.profileImage.url, user.profileImage.publicId)
    : null;

  return (
    <>
      {/* Sidebar Drawer Modal */}
      <Modal 
        visible={isOpen} 
        transparent 
        animationType="none" 
        onRequestClose={closeDrawer}
        statusBarTranslucent
      >
        <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.65)' }}>
          {/* Animated Drawer Panel on Left */}
          <Animated.View
            style={{
              width: DRAWER_WIDTH,
              height: '100%',
              backgroundColor: '#FFFFFF',
              transform: [{ translateX: slideAnim }],
              elevation: 25,
              shadowColor: '#000',
              shadowOffset: { width: 4, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 15,
            }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
            >
              {/* Top User Profile Header */}
              {user ? (
                <View
                  style={{ paddingTop: topHeaderPadding }}
                  className="bg-[#0B281E] px-5 pb-5 items-center border-b border-emerald-900/60 shadow-inner"
                >
                  {/* Avatar with Camera Overlay */}
                  <Pressable
                    onPress={handlePickImage}
                    disabled={uploadingImage}
                    className="relative active:opacity-85"
                  >
                    <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-[#153e2f] border-2 border-emerald-400 overflow-hidden shadow-lg">
                      {uploadingImage ? (
                        <ActivityIndicator size="small" color="#52B788" />
                      ) : userAvatarUrl ? (
                        <Image
                          source={{ uri: userAvatarUrl }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <Feather name="user" size={34} color="#A7F3D0" />
                      )}
                    </View>

                    {/* Camera Badge to Upload/Change Photo */}
                    <View className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full bg-emerald-600 border-2 border-[#0B281E] shadow-sm">
                      <Feather name="camera" size={11} color="#FFFFFF" />
                    </View>
                  </Pressable>

                  {/* Name & Mobile */}
                  <Text className="mt-2.5 text-base font-black text-white text-center" numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Text className="text-xs font-semibold text-emerald-200 mt-0.5 text-center">
                    {user.mobile}
                  </Text>

                  {/* Loyalty Points Badge & Account Nav */}
                  <View className="mt-3 flex-row items-center gap-2">
                    {/* Points Button */}
                    <Pressable
                      onPress={() => handleNavigate('/account/loyalty', true, t('mobile.sidebar.referEarn'))}
                      className="flex-row items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-500/20 px-3 py-1 active:scale-95"
                    >
                      <Text className="text-xs">🪙</Text>
                      <Text className="text-xs font-black text-amber-300">
                        {user.loyaltyPoints || 0} {isHindi ? 'सिक्के' : 'Coins'}
                      </Text>
                    </Pressable>

                    {/* My Account Button */}
                    <Pressable
                      onPress={() => handleNavigate('/(tabs)/account', true, t('mobile.sidebar.editProfile'))}
                      className="flex-row items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 active:scale-95"
                    >
                      <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-200">
                        {isHindi ? 'खाता' : 'Account'}
                      </Text>
                      <Feather name="chevron-right" size={11} color="#A7F3D0" />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={{ paddingTop: topHeaderPadding }} className="bg-[#0B281E] px-5 pb-5 items-center">
                  <View className="h-16 w-16 items-center justify-center rounded-full bg-[#153e2f] border border-emerald-500/40 shadow-sm mb-2.5">
                    <Feather name="user" size={32} color="#A7F3D0" />
                  </View>
                  <Text className="text-base font-black text-white text-center" numberOfLines={1}>
                    {t('mobile.sidebar.guestUser')}
                  </Text>
                  <Text className="text-xs font-semibold text-emerald-300/80 mt-0.5 text-center">
                    {t('mobile.sidebar.loginToManage')}
                  </Text>

                  <Pressable
                    onPress={() => {
                      closeDrawer();
                      router.push('/(auth)/login');
                    }}
                    className="mt-3 rounded-full bg-emerald-600 px-5 py-1.5 active:scale-95 shadow-sm"
                  >
                    <Text className="text-xs font-black uppercase tracking-wider text-white">
                      {isHindi ? 'लॉग इन करें' : 'Login / Register'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Menu Items List with Rich Colorful Badges */}
              <View className="py-2.5">
                {menuItems.map((item) => {
                  const isLocked = !user && item.requiresAuth;

                  return (
                    <Pressable
                      key={item.id}
                      onPress={item.action}
                      className="flex-row items-center gap-3.5 px-5 py-3 active:bg-emerald-50/70"
                    >
                      {/* Vibrant Themed Icon Badge */}
                      <View
                        style={{ backgroundColor: isLocked ? '#F1F5F9' : item.bgColor }}
                        className="h-9 w-9 items-center justify-center rounded-xl shadow-2xs"
                      >
                        <Feather
                          name={item.icon}
                          size={17}
                          color={isLocked ? '#94A3B8' : item.color}
                        />
                      </View>

                      {/* Label and Subtitle */}
                      <View className="flex-1">
                        <Text
                          className={`text-[13px] font-black ${
                            isLocked ? 'text-slate-500' : 'text-[#0B281E]'
                          }`}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                        {item.subtitle ? (
                          <Text
                            className="text-[10px] font-semibold text-slate-400 mt-0.5"
                            numberOfLines={1}
                          >
                            {item.subtitle}
                          </Text>
                        ) : null}
                      </View>

                      {isLocked ? (
                        <View className="flex-row items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <Feather name="lock" size={11} color="#D97706" />
                          <Text className="text-[9px] font-black text-amber-800 uppercase">Lock</Text>
                        </View>
                      ) : (
                        <Feather name="chevron-right" size={14} color="#CBD5E1" />
                      )}
                    </Pressable>
                  );
                })}

                <View className="my-2 h-[1px] bg-slate-100 mx-5" />

                {/* Sign Out / Sign In option */}
                <Pressable
                  onPress={async () => {
                    closeDrawer();
                    if (user) {
                      await storefrontApi.logout().catch(() => undefined);
                      logout();
                    } else {
                      router.push('/(auth)/login');
                    }
                  }}
                  className="flex-row items-center gap-3.5 px-5 py-3 active:bg-rose-50"
                >
                  <View className="h-9 w-9 items-center justify-center rounded-xl bg-rose-100/80 shadow-2xs">
                    <Feather name={user ? 'log-out' : 'log-in'} size={17} color="#E11D48" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[13px] font-black text-rose-600">
                      {user ? t('mobile.sidebar.signOut') : t('mobile.sidebar.signInRegister')}
                    </Text>
                    <Text className="text-[10px] font-semibold text-rose-400 mt-0.5">
                      {user
                        ? isHindi ? 'खाता सुरक्षित लॉग आउट करें' : 'Sign out securely'
                        : isHindi ? 'ऑर्डर और ऑफर्स के लिए' : 'Access orders & rewards'}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {/* Footer */}
              <View className="px-5 py-4 border-t border-slate-100 flex-row items-center justify-center gap-1 mt-auto">
                <Text className="text-[11px] font-bold text-slate-400">
                  {t('mobile.sidebar.madeWithLove')}
                </Text>
              </View>
            </ScrollView>
          </Animated.View>

          {/* Explicit Full Clickable Area to Close Drawer on Outside Tap */}
          <Pressable 
            style={{ flex: 1, height: '100%' }} 
            onPress={closeDrawer} 
            accessibilityLabel="Close Drawer"
          />
        </View>
      </Modal>

      {/* Language Selector Modal */}
      <Modal 
        visible={languageModalOpen} 
        transparent 
        animationType="fade" 
        onRequestClose={closeLanguageModal}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          {/* Backdrop Click */}
          <Pressable 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
            onPress={closeLanguageModal} 
          />

          <View className="w-full max-w-sm rounded-3xl bg-white border-2 border-emerald-200 p-6 shadow-2xl relative z-10">
            <Text className="text-lg font-black text-slate-900 mb-1 text-center">
              {t('mobile.sidebar.selectLanguage')}
            </Text>
            <Text className="text-xs text-slate-500 mb-5 text-center">
              {t('mobile.sidebar.selectLanguageSub')}
            </Text>

            <Pressable
              onPress={() => handleLanguageSelect('en')}
              className={`p-4 rounded-2xl border-2 mb-3 flex-row items-center justify-between ${
                currentLang === 'en' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-xl">🇬🇧</Text>
                <Text className="text-sm font-black text-slate-900">English</Text>
              </View>
              {currentLang === 'en' ? <Feather name="check-circle" size={18} color="#2D6A4F" /> : null}
            </Pressable>

            <Pressable
              onPress={() => handleLanguageSelect('hi')}
              className={`p-4 rounded-2xl border-2 flex-row items-center justify-between ${
                currentLang === 'hi' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-xl">🇮🇳</Text>
                <Text className="text-sm font-black text-slate-900">हिंदी (Hindi)</Text>
              </View>
              {currentLang === 'hi' ? <Feather name="check-circle" size={18} color="#2D6A4F" /> : null}
            </Pressable>

            <Pressable 
              onPress={closeLanguageModal} 
              className="mt-5 py-2 rounded-xl bg-slate-100 active:bg-slate-200 items-center justify-center"
            >
              <Text className="text-xs font-black uppercase tracking-wider text-slate-700">
                {t('common.close')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Login Prompt Modal for Guests */}
      <Modal 
        visible={!!authModalItem} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setAuthModalItem(null)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          {/* Backdrop Click */}
          <Pressable 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
            onPress={() => setAuthModalItem(null)} 
          />

          <View className="w-full max-w-sm rounded-3xl bg-white border-2 border-emerald-200 p-6 shadow-2xl items-center relative z-10">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-amber-50 border border-amber-200 mb-4">
              <Feather name="lock" size={28} color="#D97706" />
            </View>
            <Text className="text-xl font-black text-slate-900 text-center">
              {t('mobile.sidebar.loginRequired')}
            </Text>
            <Text className="mt-2 text-xs leading-5 text-slate-600 text-center mb-6">
              <Text className="font-bold text-slate-900">{authModalItem}</Text> {t('mobile.sidebar.loginRequiredSub')}
            </Text>

            <Pressable
              onPress={() => {
                setAuthModalItem(null);
                closeDrawer();
                router.push('/(auth)/login');
              }}
              style={{ backgroundColor: '#1B4332' }}
              className="w-full rounded-2xl py-3.5 items-center justify-center active:scale-95 shadow-md mb-3"
            >
              <Text style={{ color: '#FFFFFF' }} className="text-xs font-black uppercase tracking-[1.5px]">
                {t('mobile.sidebar.loginNow')}
              </Text>
            </Pressable>

            <Pressable onPress={() => setAuthModalItem(null)} className="py-2">
              <Text style={{ color: '#475569' }} className="text-xs font-bold uppercase tracking-wider">
                {t('common.cancel')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
