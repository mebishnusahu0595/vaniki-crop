import { useEffect, useRef, useState } from 'react';
import {
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
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDrawerStore } from '../store/useDrawerStore';
import { useAuthStore } from '../store/useAuthStore';
import { storefrontApi } from '../lib/api';
import { toggleAppLanguage } from '../i18n';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 320);

export function SidebarDrawer() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isOpen = useDrawerStore((state) => state.isOpen);
  const closeDrawer = useDrawerStore((state) => state.closeDrawer);
  const languageModalOpen = useDrawerStore((state) => state.languageModalOpen);
  const openLanguageModal = useDrawerStore((state) => state.openLanguageModal);
  const closeLanguageModal = useDrawerStore((state) => state.closeLanguageModal);

  const { user, logout } = useAuthStore();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [authModalItem, setAuthModalItem] = useState<string | null>(null);

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

  const menuItems = [
    {
      id: 'edit-profile',
      label: t('mobile.sidebar.editProfile'),
      icon: 'edit-3' as const,
      color: '#2D6A4F',
      requiresAuth: true,
      action: () => handleNavigate('/account/profile', true, t('mobile.sidebar.editProfile')),
    },
    {
      id: 'language',
      label: t('mobile.sidebar.language'),
      icon: 'globe' as const,
      color: '#2D6A4F',
      requiresAuth: false,
      action: () => openLanguageModal(),
    },
    {
      id: 'wishlist',
      label: t('mobile.sidebar.wishlist'),
      icon: 'heart' as const,
      color: '#2D6A4F',
      requiresAuth: true,
      action: () => handleNavigate('/account/wishlist', true, t('mobile.sidebar.wishlist')),
    },
    {
      id: 'my-farm',
      label: t('mobile.sidebar.myFarm'),
      icon: 'sun' as const,
      color: '#2D6A4F',
      requiresAuth: true,
      action: () => handleNavigate('/(tabs)/select-crop', true, t('mobile.sidebar.myFarm')),
    },
    {
      id: 'my-orders',
      label: t('mobile.sidebar.myOrders'),
      icon: 'shopping-bag' as const,
      color: '#2D6A4F',
      requiresAuth: true,
      action: () => handleNavigate('/account/orders', true, t('mobile.sidebar.myOrders')),
    },
    {
      id: 'refer-earn',
      label: t('mobile.sidebar.referEarn'),
      icon: 'user-plus' as const,
      color: '#2D6A4F',
      requiresAuth: true,
      action: () => handleNavigate('/account/loyalty', true, t('mobile.sidebar.referEarn')),
    },
    {
      id: 'contact-us',
      label: t('mobile.sidebar.contactUs'),
      icon: 'phone' as const,
      color: '#2D6A4F',
      requiresAuth: false,
      action: () => handleNavigate('/contact'),
    },
    {
      id: 'about-us',
      label: t('mobile.sidebar.aboutUs'),
      icon: 'info' as const,
      color: '#2D6A4F',
      requiresAuth: false,
      action: () => handleNavigate('/about'),
    },
    {
      id: 'privacy',
      label: t('mobile.sidebar.termsConditions'),
      icon: 'file-text' as const,
      color: '#2D6A4F',
      requiresAuth: false,
      action: () => handleNavigate('/privacy-policy'),
    },
  ];

  const handleLanguageSelect = async (lang: string) => {
    if (i18n.language !== lang) {
      await toggleAppLanguage();
    }
    closeLanguageModal();
  };

  const topHeaderPadding = Math.max(insets.top, 24) + 24;

  return (
    <>
      {/* Sidebar Drawer */}
      <Modal visible={isOpen} transparent animationType="none" onRequestClose={closeDrawer}>
        <View className="flex-1 relative" style={{ height: '100%', width: '100%' }}>
          {/* Dark Backdrop Touch to Close */}
          <Pressable className="absolute inset-0 bg-black/60" onPress={closeDrawer} />

          <Animated.View
            style={{
              width: DRAWER_WIDTH,
              height: '100%',
              backgroundColor: '#FFFFFF',
              zIndex: 99999,
              transform: [{ translateX: slideAnim }],
            }}
            className="bg-white shadow-2xl relative z-50 flex-1"
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
            >
              {/* Top User Profile Header */}
              {user ? (
                <View style={{ paddingTop: topHeaderPadding }} className="bg-[#0B281E] px-6 pb-6 items-center">
                  <View className="h-20 w-20 items-center justify-center rounded-full bg-white border-2 border-emerald-400 shadow-md mb-3">
                    <Feather name="user" size={36} color="#0B281E" />
                  </View>
                  <Text className="text-lg font-black text-white text-center" numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Text className="text-xs font-semibold text-emerald-200 mt-0.5 text-center">
                    {user.mobile}
                  </Text>
                </View>
              ) : (
                <View style={{ paddingTop: topHeaderPadding }} className="bg-emerald-50/80 px-6 pb-6 items-center">
                  <View className="h-20 w-20 items-center justify-center rounded-full bg-white border border-emerald-200 shadow-sm mb-3">
                    <Feather name="user" size={36} color="#0B281E" />
                  </View>
                  <Text className="text-lg font-black text-slate-900 text-center" numberOfLines={1}>
                    {t('mobile.sidebar.guestUser')}
                  </Text>
                  <Text className="text-xs font-semibold text-slate-600 mt-0.5 text-center">
                    {t('mobile.sidebar.loginToManage')}
                  </Text>
                </View>
              )}

              {/* Menu Items List */}
              <View className="py-2">
                {menuItems.map((item) => {
                  const isLocked = !user && item.requiresAuth;

                  return (
                    <Pressable
                      key={item.id}
                      onPress={item.action}
                      className="flex-row items-center gap-4 px-6 py-3.5 active:bg-emerald-50/80"
                    >
                      <View className="h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
                        <Feather name={item.icon} size={17} color={isLocked ? '#94A3B8' : item.color} />
                      </View>
                      <Text className={`text-sm font-bold flex-1 ${isLocked ? 'text-slate-500' : 'text-[#1B4332]'}`}>
                        {item.label}
                      </Text>
                      {isLocked ? (
                        <View className="flex-row items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <Feather name="lock" size={12} color="#D97706" />
                          <Text className="text-[9px] font-black text-amber-800 uppercase">Lock</Text>
                        </View>
                      ) : (
                        <Feather name="chevron-right" size={14} color="#A3B8B0" />
                      )}
                    </Pressable>
                  );
                })}

                <View className="my-2 h-[1px] bg-primary-100 mx-6" />

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
                  className="flex-row items-center gap-4 px-6 py-3.5 active:bg-rose-50"
                >
                  <View className="h-8 w-8 items-center justify-center rounded-xl bg-rose-50">
                    <Feather name={user ? 'log-out' : 'log-in'} size={17} color="#DC2626" />
                  </View>
                  <Text className="text-sm font-bold text-rose-600 flex-1">
                    {user ? t('mobile.sidebar.signOut') : t('mobile.sidebar.signInRegister')}
                  </Text>
                </Pressable>
              </View>

              {/* Footer */}
              <View className="px-6 py-4 border-t border-primary-100 flex-row items-center justify-center gap-1 mt-auto">
                <Feather name="heart" size={12} color="#DC2626" />
                <Text className="text-[11px] font-bold text-primary-900/60">Made with ❤️ in India</Text>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Language Selector Modal */}
      <Modal visible={languageModalOpen} transparent animationType="fade" onRequestClose={closeLanguageModal}>
        <Pressable className="flex-1 bg-black/75 justify-center items-center p-5" onPress={closeLanguageModal}>
          <View className="w-full max-w-sm rounded-3xl bg-white border-2 border-emerald-200 p-6 shadow-2xl">
            <Text className="text-lg font-black text-slate-900 mb-2 text-center">Select App Language / भाषा चुने</Text>
            <Text className="text-xs text-slate-500 mb-5 text-center">Choose your preferred language for Vaniki Crop</Text>

            <Pressable
              onPress={() => handleLanguageSelect('en')}
              className={`p-4 rounded-2xl border-2 mb-3 flex-row items-center justify-between ${
                i18n.language === 'en' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-xl">🇬🇧</Text>
                <Text className="text-sm font-black text-slate-900">English</Text>
              </View>
              {i18n.language === 'en' ? <Feather name="check-circle" size={18} color="#2D6A4F" /> : null}
            </Pressable>

            <Pressable
              onPress={() => handleLanguageSelect('hi')}
              className={`p-4 rounded-2xl border-2 flex-row items-center justify-between ${
                i18n.language === 'hi' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-xl">🇮🇳</Text>
                <Text className="text-sm font-black text-slate-900">हिंदी (Hindi)</Text>
              </View>
              {i18n.language === 'hi' ? <Feather name="check-circle" size={18} color="#2D6A4F" /> : null}
            </Pressable>

            <Pressable onPress={closeLanguageModal} className="mt-5 py-2">
              <Text className="text-center text-xs font-bold uppercase tracking-wider text-emerald-800">
                {i18n.language === 'hi' ? 'बंद करें' : 'Close'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Login Prompt Modal for Guests */}
      <Modal visible={!!authModalItem} transparent animationType="fade" onRequestClose={() => setAuthModalItem(null)}>
        <Pressable className="flex-1 bg-black/75 justify-center items-center p-5" onPress={() => setAuthModalItem(null)}>
          <View className="w-full max-w-sm rounded-3xl bg-white border-2 border-emerald-200 p-6 shadow-2xl items-center">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-amber-50 border border-amber-200 mb-4">
              <Feather name="lock" size={28} color="#D97706" />
            </View>
            <Text className="text-xl font-black text-slate-900 text-center">
              {i18n.language === 'hi' ? 'लॉगिन आवश्यक है' : 'Login Required'}
            </Text>
            <Text className="mt-2 text-xs leading-5 text-slate-600 text-center mb-6">
              {i18n.language === 'hi' ? (
                <>
                  <Text className="font-bold text-slate-900">{authModalItem}</Text> फ़ीचर का उपयोग करने के लिए कृपया पहले लॉगिन या साइनअप करें।
                </>
              ) : (
                <>
                  Please login or signup first to access the <Text className="font-bold text-slate-900">{authModalItem}</Text> feature.
                </>
              )}
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
                {i18n.language === 'hi' ? 'लॉगिन / साइनअप करें' : 'Login / Signup Now'}
              </Text>
            </Pressable>

            <Pressable onPress={() => setAuthModalItem(null)} className="py-2">
              <Text style={{ color: '#475569' }} className="text-xs font-bold uppercase tracking-wider">
                {i18n.language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
