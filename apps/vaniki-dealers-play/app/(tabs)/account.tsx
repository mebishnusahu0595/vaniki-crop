import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../../src/store/useAuthStore';
import { dealerApi } from '../../src/lib/api';
import { currencyFormatter } from '../../src/utils/format';

const Icon = Feather as any;

export default function DealerAccountScreen() {
  const { user, logout } = useAuthStore();

  const settlementsQuery = useQuery({
    queryKey: ['dealer-settlements'],
    queryFn: dealerApi.getSettlements,
  });

  const referralsQuery = useQuery({
    queryKey: ['dealer-referrals'],
    queryFn: dealerApi.getReferrals,
  });

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out from Vaniki Dealers?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const menuSections = [
    {
      title: 'Business & Operations',
      items: [
        {
          icon: 'shopping-bag',
          label: 'My Bulk Orders',
          subtitle: 'Track order statuses and dispatches',
          onPress: () => router.push('/(tabs)/orders'),
        },
        {
          icon: 'file-text',
          label: 'B2B Invoices',
          subtitle: 'GST tax invoices and credit notes',
          onPress: () => router.push('/(tabs)/invoices'),
        },
        {
          icon: 'package',
          label: 'Bulk Catalogue',
          subtitle: 'View all products with MOQ pricing',
          onPress: () => router.push('/(tabs)/products'),
        },
      ],
    },
    {
      title: 'Support & Help',
      items: [
        {
          icon: 'phone',
          label: 'Dealer Helpline',
          subtitle: '+91 98765 43210 (Toll Free)',
          onPress: () => Linking.openURL('tel:9876543210'),
        },
        {
          icon: 'mail',
          label: 'Email Support',
          subtitle: 'support@vanikicrop.com',
          onPress: () => Linking.openURL('mailto:support@vanikicrop.com'),
        },
        {
          icon: 'shield',
          label: 'Privacy Policy',
          subtitle: 'Terms of service & privacy',
          onPress: () => Linking.openURL('https://vanikicrop.com/privacy-policy'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Profile Card */}
        <View className="bg-primary-700 px-5 pt-4 pb-8">
          <View className="flex-row items-center gap-4">
            <View className="w-16 h-16 rounded-[22px] bg-white/15 border border-white/25 items-center justify-center">
              <Icon name="user" size={30} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-black text-white">{user?.name || 'Dealer Admin'}</Text>
                <View className="rounded-full bg-emerald-400/20 px-2 py-0.5 border border-emerald-400/40">
                  <Text className="text-[9px] font-black text-emerald-300 uppercase">Verified</Text>
                </View>
              </View>
              {user?.storeName ? (
                <Text className="text-xs font-semibold text-white/80 mt-0.5">
                  🏪 {user.storeName}
                </Text>
              ) : null}
              <Text className="text-xs font-bold text-white/60 mt-0.5">
                📞 +91 {user?.mobile || '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Menu Sections */}
        <View className="px-4 -mt-3 gap-5">
          {menuSections.map((section) => (
            <View key={section.title}>
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-400 mb-2 px-1">
                {section.title}
              </Text>
              <View className="rounded-[24px] border border-primary-100 bg-white overflow-hidden shadow-xs divide-y divide-slate-100">
                {section.items.map((item) => (
                  <Pressable
                    key={item.label}
                    onPress={item.onPress}
                    className="flex-row items-center justify-between p-4 active:bg-slate-50"
                  >
                    <View className="flex-row items-center gap-3.5 flex-1 pr-2">
                      <View className="w-10 h-10 rounded-2xl bg-primary-50 items-center justify-center">
                        <Icon name={item.icon} size={18} color="#2D6A4F" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-black text-primary-900">{item.label}</Text>
                        {item.subtitle ? (
                          <Text className="text-[11px] font-semibold text-slate-400 mt-0.5">
                            {item.subtitle}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Icon name="chevron-right" size={18} color="#CBD5E1" />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          {/* Logout Button */}
          <Pressable
            onPress={handleLogout}
            className="flex-row items-center justify-center gap-2 rounded-[20px] border border-rose-200 bg-rose-50 py-4 active:scale-98 mt-2"
          >
            <Icon name="log-out" size={18} color="#E11D48" />
            <Text className="text-sm font-black uppercase tracking-wider text-rose-700">
              Log Out
            </Text>
          </Pressable>

          {/* App Version Info */}
          <View className="items-center py-4">
            <Text className="text-[11px] font-bold text-slate-400">
              Vaniki Dealers (Play Edition) • v1.0.0
            </Text>
            <Text className="text-[10px] font-semibold text-slate-400 mt-0.5">
              Secure B2B Agri-Input Trading Platform
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
