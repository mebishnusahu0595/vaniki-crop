import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../../src/components/Screen';
import { storefrontApi } from '../../src/lib/api';
import { currencyFormatter } from '../../src/utils/format';

export default function OrderSuccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const orderQuery = useQuery({
    queryKey: ['mobile-order-detail', id],
    queryFn: () => storefrontApi.orderDetail(id || ''),
    enabled: Boolean(id),
  });

  const order = orderQuery.data;

  return (
    <Screen withServiceBar={false}>
      <View className="mt-16 rounded-[32px] bg-white p-8">
        <View className="mx-auto h-24 w-24 items-center justify-center rounded-full bg-emerald-500">
          <Text className="text-5xl font-black text-white">✓</Text>
        </View>
        <Text className="mt-5 text-[11px] font-black uppercase tracking-[2px] text-emerald-600">Order Confirmed</Text>
        <Text className="mt-3 text-3xl font-black text-primary-900">Order Placed Successfully.</Text>

        {order ? (
          <View className="mt-5 rounded-[24px] border border-primary-100 bg-primary-50/50 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-primary-500">Order Number</Text>
              <Text className="text-sm font-black text-primary-900">#{order.orderNumber}</Text>
            </View>
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-primary-500">Amount</Text>
              <Text className="text-sm font-black text-primary-900">
                {currencyFormatter.format(order.totalAmount)}
              </Text>
            </View>
          </View>
        ) : null}

        <Text className="mt-4 text-sm leading-7 text-primary-900/70">
          Your order is confirmed and being processed.
        </Text>

        {id ? (
          <Pressable
            onPress={() => router.replace({ pathname: '/order/[id]', params: { id } })}
            className="mt-6 rounded-full bg-primary-500 px-5 py-4"
          >
            <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
              View Order Details
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => router.replace('/(tabs)')}
          className="mt-3 rounded-full border border-primary-200 bg-white px-5 py-4"
        >
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-900">Go to Home</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
