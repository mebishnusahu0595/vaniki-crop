import { Pressable, Text, View, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useServiceModeStore } from '../../src/store/useServiceModeStore';
import { useStoreStore } from '../../src/store/useStoreStore';
import { storefrontApi } from '../../src/lib/api';

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const mode = useServiceModeStore((state) => state.mode);

  if (!user) {
    return (
      <Screen>
        <View className="rounded-[28px] bg-white p-8 items-center border border-primary-100 shadow-sm">
          <View className="h-16 w-16 rounded-full bg-emerald-50 items-center justify-center mb-3">
            <Feather name="user" size={32} color="#2D6A4F" />
          </View>
          <Text className="text-2xl font-black text-primary-900 text-center">
            {t('mobile.sidebar.loginRequired')}
          </Text>
          <Text className="mt-3 text-sm leading-6 text-primary-900/70 text-center">
            {t('mobile.sidebar.loginToManage')}
          </Text>
          <Pressable 
            onPress={() => router.push('/(auth)/login')} 
            className="mt-6 rounded-full bg-primary-500 px-8 py-4 active:scale-95 shadow-md"
          >
            <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
              {t('mobile.accountPage.loginBtn')}
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const menuItems = [
    {
      title: t('mobile.sidebar.myOrders'),
      description: i18n.language === 'hi' ? 'ऑर्डर इतिहास और स्थिति देखें' : 'View order history & details',
      icon: 'package' as const,
      route: '/account/orders' as const,
    },
    {
      title: t('mobile.sidebar.referEarn'),
      description: i18n.language === 'hi' ? 'दैनिक रिवॉर्ड अंक व रेफरल कोड' : 'Daily check-in points & referral code',
      icon: 'award' as const,
      route: '/account/loyalty' as const,
    },
    {
      title: t('mobile.sidebar.wishlist'),
      description: i18n.language === 'hi' ? 'पसंदीदा सहेजी गई दवाइयां' : 'Your saved favorite items',
      icon: 'heart' as const,
      route: '/account/wishlist' as const,
    },
    {
      title: t('mobile.sidebar.editProfile'),
      description: i18n.language === 'hi' ? 'व्यक्तिगत जानकारी और पता' : 'Manage personal info & address details',
      icon: 'map-pin' as const,
      route: '/account/profile' as const,
    },
    {
      title: i18n.language === 'hi' ? 'सुरक्षा और पासवर्ड' : 'Security & Password',
      description: i18n.language === 'hi' ? 'खाता पासवर्ड अपडेट करें' : 'Update account password',
      icon: 'lock' as const,
      route: '/account/password' as const,
    },
  ];

  const exploreItems = [
    { title: t('mobile.sidebar.aboutUs'), route: '/about' as const },
    { title: t('mobile.sidebar.contactUs'), route: '/contact' as const },
    { title: t('mobile.sidebar.privacyPolicy'), route: '/privacy-policy' as const },
  ];

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile Card Header */}
        <View className="rounded-[32px] bg-primary-900 p-6 shadow-lg relative overflow-hidden">
          <View className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-primary-800 opacity-40" />
          <View className="absolute -left-10 -bottom-10 w-28 h-28 rounded-full bg-primary-800 opacity-40" />

          <View className="flex-row items-center gap-4">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-white border border-primary-100">
              <Text className="text-xl font-black text-primary-900">
                {getInitials(user.name)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-xl font-black text-white">{user.name}</Text>
              <View className="flex-row flex-wrap items-center gap-2 mt-1">
                <Text className="text-xs font-semibold text-primary-100/70">{user.mobile}</Text>
                {user.referralCode ? (
                  <View className="rounded-full bg-emerald-500/30 px-2 py-0.5 border border-emerald-400/40">
                    <Text className="text-[10px] font-black uppercase text-emerald-200">
                      REF: {user.referralCode}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* Action Menu List */}
        <View className="mt-6 gap-3">
          {menuItems.map((item) => (
            <Pressable
              key={item.route}
              onPress={() => router.push(item.route)}
              className="flex-row items-center gap-4 rounded-3xl border border-primary-100 bg-white p-4 active:bg-primary-50 shadow-2xs"
            >
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary-50">
                <Feather name={item.icon} size={20} color="#2D6A4F" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-black text-primary-900">{item.title}</Text>
                <Text className="mt-0.5 text-xs font-semibold text-primary-900/60">{item.description}</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#A3B8B0" />
            </Pressable>
          ))}
        </View>

        {/* Explore & Legal Links */}
        <View className="mt-6 rounded-3xl border border-primary-100 bg-white p-4 shadow-2xs">
          {exploreItems.map((item, idx) => (
            <View key={item.route}>
              <Pressable
                onPress={() => router.push(item.route)}
                className="flex-row items-center justify-between py-3 px-2 active:opacity-75"
              >
                <Text className="text-sm font-bold text-primary-900">{item.title}</Text>
                <Feather name="chevron-right" size={14} color="#A3B8B0" />
              </Pressable>
              {idx < exploreItems.length - 1 ? <View className="h-px bg-primary-50 my-1" /> : null}
            </View>
          ))}
        </View>

        {/* Sign Out Button */}
        <Pressable
          onPress={async () => {
            await storefrontApi.logout().catch(() => undefined);
            logout();
          }}
          className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 py-4 active:bg-rose-100"
        >
          <Feather name="log-out" size={16} color="#DC2626" />
          <Text className="text-xs font-black uppercase tracking-wider text-rose-600">
            {t('mobile.sidebar.signOut')}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
