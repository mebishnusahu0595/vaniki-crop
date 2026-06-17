import { Pressable, Text, View, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useServiceModeStore } from '../../src/store/useServiceModeStore';
import { useStoreStore } from '../../src/store/useStoreStore';
import { storefrontApi } from '../../src/lib/api';

export default function AccountScreen() {
  const { user, logout } = useAuthStore();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const mode = useServiceModeStore((state) => state.mode);

  if (!user) {
    return (
      <Screen>
        <View className="rounded-[28px] bg-white p-8">
          <Text className="text-2xl font-black text-primary-900">Sign in to continue.</Text>
          <Text className="mt-3 text-sm leading-6 text-primary-900/70">
            Track orders, save addresses, and manage your account from here.
          </Text>
          <Pressable onPress={() => router.push('/(auth)/login')} className="mt-6 rounded-full bg-primary-500 px-5 py-4 active:scale-95">
            <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">Login</Text>
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
      title: 'My Orders',
      description: 'View order history & details',
      icon: 'package' as const,
      route: '/account/orders' as const,
    },
    {
      title: 'Loyalty Rewards',
      description: 'Collect daily points, view history',
      icon: 'award' as const,
      route: '/account/loyalty' as const,
    },
    {
      title: 'My Wishlist',
      description: 'Your saved favorite items',
      icon: 'heart' as const,
      route: '/account/wishlist' as const,
    },
    {
      title: 'Edit Profile & Address',
      description: 'Manage personal info & address details',
      icon: 'map-pin' as const,
      route: '/account/profile' as const,
    },
    {
      title: 'Security & Password',
      description: 'Update account password',
      icon: 'lock' as const,
      route: '/account/password' as const,
    },
  ];

  const exploreItems = [
    { title: 'About Vaniki', route: '/about' as const },
    { title: 'Contact Support', route: '/contact' as const },
    { title: 'Privacy Policy', route: '/privacy-policy' as const },
  ];

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile Card Header */}
        <View className="rounded-[32px] bg-primary-900 p-6 shadow-lg relative overflow-hidden">
          {/* Subtle background decoration */}
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
                  <>
                    <Text className="text-xs text-primary-100/40">•</Text>
                    <Text className="text-xs font-black text-amber-300">Ref: {user.referralCode}</Text>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* Quick Info Grid */}
        <View className="mt-4 flex-row gap-3">
          {/* Loyalty Points */}
          <View className="flex-1 rounded-[24px] bg-amber-50 border border-amber-100 p-4 flex-row items-center justify-between shadow-sm">
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-amber-900/60">Balance</Text>
              <Text className="text-2xl font-black text-amber-900 mt-1">{user.loyaltyPoints || 0}</Text>
            </View>
            <Image source={require('../../assets/coin.png')} style={{ width: 36, height: 36 }} />
          </View>

          {/* Service Mode */}
          <View className="flex-1 rounded-[24px] bg-[#f4f7f6] border border-primary-100 p-4 shadow-sm">
            <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-primary-900/50">Service Mode</Text>
            <Text className="text-sm font-black text-primary-900 mt-1 uppercase tracking-[1px]">{mode}</Text>
            <Text className="text-[10px] text-primary-900/60 mt-0.5" numberOfLines={1}>
              {mode === 'pickup' && selectedStore ? selectedStore.name : 'Home Delivery'}
            </Text>
          </View>
        </View>

        {/* Menu Rows */}
        <View className="mt-6 rounded-[32px] bg-white border border-primary-100 overflow-hidden shadow-sm">
          {menuItems.map((item, index) => (
            <Pressable
              key={item.title}
              onPress={() => router.push(item.route as any)}
              className="flex-row items-center justify-between p-4 active:bg-primary-50/50 border-b border-primary-50"
              style={({ pressed }) => pressed && { opacity: 0.95 }}
            >
              <View className="flex-row items-center gap-4 flex-1">
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-primary-50">
                  <Feather name={item.icon} size={18} color="#082018" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-black text-primary-900">{item.title}</Text>
                  <Text className="text-xs text-primary-900/50 mt-0.5">{item.description}</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color="#A3B8B0" />
            </Pressable>
          ))}
        </View>

        {/* Explore Links */}
        <View className="mt-6 rounded-[32px] bg-white border border-primary-100 p-4 shadow-sm">
          <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500 mb-3 px-2">Info & Legal</Text>
          {exploreItems.map((item, index) => (
            <Pressable
              key={item.title}
              onPress={() => router.push(item.route)}
              className="flex-row items-center justify-between py-3.5 px-2 border-b border-primary-50 last:border-b-0 active:scale-[0.99]"
            >
              <Text className="text-sm font-bold text-primary-900">{item.title}</Text>
              <Feather name="arrow-right" size={14} color="#A3B8B0" />
            </Pressable>
          ))}
        </View>

        {/* Log Out button */}
        <Pressable
          onPress={async () => {
            await storefrontApi.logout().catch(() => undefined);
            logout();
          }}
          className="mt-8 rounded-full bg-rose-50 border border-rose-100 py-4 active:scale-95"
        >
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-rose-600">
            Log Out
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
