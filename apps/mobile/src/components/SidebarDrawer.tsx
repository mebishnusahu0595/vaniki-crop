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
import { setAppLanguage, getAppLanguage, type AppLanguage } from '../i18n';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 320);

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

  const handleLanguageSelect = async (lang: AppLanguage) => {
    await setAppLanguage(lang);
    closeLanguageModal();
  };

  const topHeaderPadding = Math.max(insets.top, 24) + 20;

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
                <View style={{ paddingTop: topHeaderPadding }} className="bg-[#0B281E] px-6 pb-6 items-center">
                  <View className="h-16 w-16 items-center justify-center rounded-full bg-white border-2 border-emerald-400 shadow-md mb-2.5">
                    <Feather name="user" size={32} color="#0B281E" />
                  </View>
                  <Text className="text-base font-black text-white text-center" numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Text className="text-xs font-semibold text-emerald-200 mt-0.5 text-center">
                    {user.mobile}
                  </Text>
                </View>
              ) : (
                <View style={{ paddingTop: topHeaderPadding }} className="bg-emerald-50/80 px-6 pb-6 items-center">
                  <View className="h-16 w-16 items-center justify-center rounded-full bg-white border border-emerald-200 shadow-sm mb-2.5">
                    <Feather name="user" size={32} color="#0B281E" />
                  </View>
                  <Text className="text-base font-black text-slate-900 text-center" numberOfLines={1}>
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
                <Text className="text-[11px] font-bold text-primary-900/60">{t('mobile.sidebar.madeWithLove')}</Text>
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
