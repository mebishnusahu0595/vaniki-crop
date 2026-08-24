import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { dealerApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { currencyFormatter, getPrimaryImage } from '../../src/utils/format';

const Icon = Feather as any;

export default function DealerHomeScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const catalogueQuery = useQuery({
    queryKey: ['bulk-catalogue', { limit: 8 }],
    queryFn: () => dealerApi.getBulkCatalogue({ limit: 8 }),
  });

  const analyticsQuery = useQuery({
    queryKey: ['dealer-analytics', '30d'],
    queryFn: () => dealerApi.getAnalytics('30d'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['bulk-catalogue'] }),
      queryClient.invalidateQueries({ queryKey: ['dealer-analytics'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const products = catalogueQuery.data?.data || [];
  const analytics = analyticsQuery.data?.data;

  const stats = [
    {
      label: 'Total Orders',
      value: analytics?.stats?.totalOrders ?? '—',
      icon: 'shopping-bag',
      color: '#2D6A4F',
      bg: '#F0FAF5',
    },
    {
      label: 'Total Revenue',
      value: analytics?.stats?.totalRevenue
        ? currencyFormatter.format(analytics.stats.totalRevenue)
        : '—',
      icon: 'trending-up',
      color: '#1D4ED8',
      bg: '#EFF6FF',
    },
    {
      label: 'Pending Orders',
      value: analytics?.stats?.pendingOrders ?? '—',
      icon: 'clock',
      color: '#D97706',
      bg: '#FFFBEB',
    },
    {
      label: 'This Month',
      value: analytics?.stats?.monthlyRevenue
        ? currencyFormatter.format(analytics.stats.monthlyRevenue)
        : '—',
      icon: 'calendar',
      color: '#7C3AED',
      bg: '#F5F3FF',
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D6A4F" />}
      >
        {/* Header */}
        <View className="bg-primary-700 px-5 pt-4 pb-8">
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-1">
              <Text className="text-xs font-black uppercase tracking-[2px] text-white/60">
                Vaniki Dealers
              </Text>
              <Text className="text-xl font-black text-white leading-tight mt-1" numberOfLines={1}>
                Namaste, {user?.name?.split(' ')[0] || 'Dealer'} 👋
              </Text>
              {user?.storeName ? (
                <Text className="text-xs font-semibold text-white/70 mt-0.5">
                  {user.storeName}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/account')}
              className="w-11 h-11 rounded-full bg-white/15 border border-white/20 items-center justify-center"
            >
              <Icon name="user" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Stats Cards */}
        <View className="px-4 -mt-4">
          <View className="bg-white rounded-[24px] p-4 shadow-soft border border-primary-100">
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-400 mb-3">
              Last 30 Days Overview
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {stats.map((s) => (
                <View
                  key={s.label}
                  className="flex-1 min-w-[44%] rounded-2xl p-3"
                  style={{ backgroundColor: s.bg }}
                >
                  <View
                    className="w-8 h-8 rounded-xl items-center justify-center mb-2"
                    style={{ backgroundColor: s.color + '22' }}
                  >
                    <Icon name={s.icon} size={16} color={s.color} />
                  </View>
                  <Text className="text-base font-black text-slate-900">{s.value}</Text>
                  <Text className="text-[10px] font-semibold text-slate-500 mt-0.5">{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-4 mt-6">
          <Text className="text-xs font-black uppercase tracking-[2px] text-primary-400 mb-3">
            Quick Actions
          </Text>
          <View className="flex-row gap-3">
            {[
              { label: 'Place Order', icon: 'plus-circle', route: '/(tabs)/products' },
              { label: 'My Orders', icon: 'list', route: '/(tabs)/orders' },
              { label: 'Invoices', icon: 'file-text', route: '/(tabs)/invoices' },
              { label: 'Account', icon: 'user', route: '/(tabs)/account' },
            ].map((a) => (
              <Pressable
                key={a.label}
                onPress={() => router.push(a.route as any)}
                className="flex-1 items-center rounded-2xl bg-white border border-primary-100 py-3 px-1 active:scale-95"
              >
                <View className="w-9 h-9 rounded-xl bg-primary-50 items-center justify-center mb-1">
                  <Icon name={a.icon} size={18} color="#2D6A4F" />
                </View>
                <Text className="text-[10px] font-black text-primary-900 text-center">{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Featured Products */}
        <View className="mt-6 px-4">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-emerald-600">
                Bulk Catalogue
              </Text>
              <Text className="text-xl font-black text-primary-900 leading-tight">
                Featured Products
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/products')}
              className="flex-row items-center gap-1 bg-primary-50 rounded-full px-3 py-1.5 active:scale-95"
            >
              <Text className="text-xs font-black text-primary-700">View All</Text>
              <Icon name="arrow-right" size={12} color="#2D6A4F" />
            </Pressable>
          </View>

          {catalogueQuery.isLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator size="large" color="#2D6A4F" />
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-3">
              {products.slice(0, 4).map((product: any) => (
                <DealerProductCard key={product.id || product._id} product={product} compact />
              ))}
            </View>
          )}
        </View>

        {/* B2B Info Banner */}
        <View className="mx-4 mt-6 mb-8 rounded-[20px] bg-primary-700 p-5 overflow-hidden">
          <Text className="text-[10px] font-black uppercase tracking-[2px] text-emerald-300 mb-1">
            Dealer Advantage
          </Text>
          <Text className="text-lg font-black text-white leading-snug">
            Bulk Orders with{'\n'}Assured Quality
          </Text>
          <Text className="text-xs font-semibold text-white/70 mt-1 mb-4">
            Order by minimum quantity, get invoices instantly, track settlements.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/products')}
            className="self-start bg-white rounded-full px-4 py-2 active:scale-95"
          >
            <Text className="text-xs font-black text-primary-800">Browse Catalogue →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Dealer Product Card (small, home use) ────────────────────────────────

function DealerProductCard({ product, compact }: { product: any; compact?: boolean }) {
  const primaryImage = getPrimaryImage(product);
  const defaultVariant = product.variants?.[0];
  const moq = product.moq || 1;

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })
      }
      className="flex-1 min-w-[44%] overflow-hidden rounded-[20px] border border-primary-100 bg-white active:scale-[0.98]"
    >
      <View className="relative bg-[#f4f7f6] pt-2">
        <Image
          source={{ uri: primaryImage }}
          placeholder={{ uri: 'https://placehold.co/400x400?text=Vaniki+Crop' }}
          style={{ width: '100%', height: 110 }}
          contentFit="contain"
          transition={400}
        />
        {/* MOQ Badge */}
        <View className="absolute left-2 top-2 rounded-full bg-emerald-700 px-2 py-0.5">
          <Text className="text-[8px] font-black text-white uppercase">
            Min {moq} {moq === 1 ? 'unit' : 'units'}
          </Text>
        </View>
      </View>
      <View className="p-2.5">
        <Text className="text-[9px] font-black uppercase tracking-[1px] text-primary-400">
          {product.category?.name || 'Crop Care'}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 text-[12px] font-black text-primary-900 leading-tight">
          {product.name}
        </Text>
        {defaultVariant ? (
          <Text className="mt-1 text-sm font-black text-primary-700">
            {currencyFormatter.format(defaultVariant.price)}
            <Text className="text-[10px] font-semibold text-primary-400"> /unit</Text>
          </Text>
        ) : null}
        <Pressable
          onPress={() =>
            router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })
          }
          style={{ backgroundColor: '#143D2E' }}
          className="mt-2 rounded-full py-2 items-center active:scale-95"
        >
          <Text className="text-[10px] font-black uppercase tracking-[1px] text-white">Order Now</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
