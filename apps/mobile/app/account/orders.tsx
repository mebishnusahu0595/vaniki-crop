import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Screen } from '../../src/components/Screen';
import { storefrontApi } from '../../src/lib/api';
import { currencyFormatter } from '../../src/utils/format';
import { Skeleton } from '../../src/components/Skeleton';

export default function OrdersHistoryScreen() {
  const ordersQuery = useQuery({
    queryKey: ['mobile-orders'],
    queryFn: () => storefrontApi.orders(),
  });

  const orders = ordersQuery.data?.data || [];

  return (
    <Screen scroll={false}>
      <View className="flex-row items-center gap-3 mb-6">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-primary-50 active:scale-90">
          <Feather name="arrow-left" size={18} color="#082018" />
        </Pressable>
        <Text className="text-2xl font-black text-primary-900">Order History</Text>
      </View>

      {ordersQuery.isLoading ? (
        <View className="flex-1">
          {[1, 2, 3].map((i) => (
            <View key={i} className="mb-4 rounded-[24px] bg-white border border-primary-100 p-5 flex-row items-center justify-between">
              <View className="flex-1 pr-4 gap-2">
                <Skeleton width={120} height={10} borderRadius={4} />
                <Skeleton width={80} height={18} borderRadius={4} className="mt-1" />
                <View className="mt-2 flex-row items-center gap-2">
                  <Skeleton width={8} height={8} borderRadius={4} />
                  <Skeleton width={60} height={10} borderRadius={4} />
                </View>
              </View>
              <Feather name="chevron-right" size={16} color="#E2ECE9" />
            </View>
          ))}
        </View>
      ) : orders.length ? (
        <View className="flex-1">
          <FlashList
            data={orders}
            showsVerticalScrollIndicator={false}
            estimatedItemSize={120}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push({ pathname: '/order/[id]', params: { id: item.id } } as any)}
                className="mb-4 rounded-[24px] bg-white border border-primary-100 p-5 flex-row items-center justify-between active:scale-[0.99] active:bg-slate-50/50"
              >
                <View className="flex-1 pr-4">
                  <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-primary-500">
                    Order #{item.orderNumber}
                  </Text>
                  <Text className="mt-1 text-lg font-black text-primary-900">
                    {currencyFormatter.format(item.totalAmount)}
                  </Text>
                  <View className="mt-2 flex-row items-center gap-2">
                    <View className={`h-2 w-2 rounded-full ${
                      item.status === 'delivered' ? 'bg-emerald-500' :
                      item.status === 'cancelled' ? 'bg-rose-500' : 'bg-amber-500'
                    }`} />
                    <Text className="text-xs font-bold text-primary-900/60 uppercase tracking-[0.5px]">
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color="#A3B8B0" />
              </Pressable>
            )}
          />
        </View>
      ) : (
        <View className="flex-1 justify-center items-center px-6">
          <Feather name="package" size={48} color="#A3B8B0" />
          <Text className="mt-4 text-lg font-black text-primary-900">No orders yet</Text>
          <Text className="mt-2 text-sm text-center text-primary-900/60 leading-6">
            You haven't placed any orders with Vaniki Crop yet. Start shopping now!
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)')}
            className="mt-6 rounded-full bg-primary-500 px-6 py-3.5 active:scale-95"
          >
            <Text className="text-xs font-black uppercase tracking-[1.5px] text-white">Explore Products</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}
