import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { dealerApi } from '../../src/lib/api';
import { currencyFormatter } from '../../src/utils/format';

const Icon = Feather as any;

const STATUS_FILTERS = [
  { key: '', label: 'All Orders' },
  { key: 'placed', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'delivered', label: 'Delivered' },
];

export default function DealerOrdersScreen() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const ordersQuery = useQuery({
    queryKey: ['dealer-orders', selectedStatus],
    queryFn: () => dealerApi.getMyOrders({ status: selectedStatus || undefined, limit: 30 }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['dealer-orders'] });
    setRefreshing(false);
  }, [queryClient]);

  const orders = ordersQuery.data?.data || [];

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="bg-white border-b border-primary-100 px-4 pt-3 pb-3">
        <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">
          Order Management
        </Text>
        <Text className="text-xl font-black text-primary-900 leading-tight mt-0.5">
          My Orders
        </Text>
      </View>

      {/* Status Filter Chips */}
      <View className="bg-white border-b border-primary-50 py-2.5 px-4">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.key || 'all'}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => {
            const isSelected = selectedStatus === item.key;
            return (
              <Pressable
                onPress={() => setSelectedStatus(item.key)}
                className={`rounded-full px-4 py-1.5 border active:scale-95 ${
                  isSelected
                    ? 'bg-primary-700 border-primary-700'
                    : 'bg-white border-primary-100'
                }`}
              >
                <Text
                  className={`text-xs font-black ${
                    isSelected ? 'text-white' : 'text-primary-900'
                  }`}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Orders List */}
      {ordersQuery.isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#2D6A4F" />
          <Text className="mt-3 text-xs font-bold text-slate-500">Loading orders...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <View className="w-16 h-16 rounded-full bg-primary-50 items-center justify-center mb-3">
            <Icon name="shopping-bag" size={32} color="#2D6A4F" />
          </View>
          <Text className="text-base font-black text-slate-800 text-center">No Orders Found</Text>
          <Text className="text-xs font-semibold text-slate-500 text-center mt-1">
            Bulk orders placed through the app will appear here.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/products')}
            style={{ backgroundColor: '#143D2E' }}
            className="mt-5 rounded-full px-6 py-3 active:scale-95"
          >
            <Text className="text-xs font-black uppercase tracking-wider text-white">
              Browse Catalogue →
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id || item._id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D6A4F" />
          }
          renderItem={({ item }) => <OrderItemCard order={item} />}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Order Item Card ──────────────────────────────────────────────────────

function OrderItemCard({ order }: { order: any }) {
  const statusColorMap: Record<string, { bg: string; text: string }> = {
    placed: { bg: '#FEF3C7', text: '#92400E' },
    confirmed: { bg: '#DBEAFE', text: '#1E40AF' },
    processing: { bg: '#EDE9FE', text: '#5B21B6' },
    shipped: { bg: '#E0E7FF', text: '#3730A3' },
    delivered: { bg: '#D1FAE5', text: '#065F46' },
    cancelled: { bg: '#FEE2E2', text: '#991B1B' },
  };

  const statusStyle = statusColorMap[order.status?.toLowerCase()] || {
    bg: '#F1F5F9',
    text: '#475569',
  };

  const dateStr = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  const itemsCount = (order.items || []).reduce(
    (acc: number, item: any) => acc + (item.quantity || item.qty || 1),
    0,
  );

  return (
    <View className="rounded-[22px] border border-primary-100 bg-white p-4 shadow-xs">
      {/* Top row */}
      <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
        <View>
          <Text className="text-xs font-black text-primary-900">
            #{order.orderNumber || order.id?.slice(-8) || 'ORDER'}
          </Text>
          <Text className="text-[10px] font-bold text-slate-400 mt-0.5">{dateStr}</Text>
        </View>
        <View
          style={{ backgroundColor: statusStyle.bg }}
          className="rounded-full px-3 py-1"
        >
          <Text
            style={{ color: statusStyle.text }}
            className="text-[10px] font-black uppercase tracking-wider"
          >
            {order.status || 'Placed'}
          </Text>
        </View>
      </View>

      {/* Items preview */}
      <View className="py-3 gap-1.5 border-b border-slate-100">
        {(order.items || []).slice(0, 2).map((item: any, idx: number) => (
          <View key={idx} className="flex-row items-center justify-between">
            <Text numberOfLines={1} className="flex-1 text-xs font-bold text-slate-700 pr-2">
              {item.product?.name || item.name || 'Product'}
            </Text>
            <Text className="text-xs font-black text-slate-900">
              x{item.quantity || item.qty || 1}
            </Text>
          </View>
        ))}
        {(order.items || []).length > 2 && (
          <Text className="text-[10px] font-semibold text-primary-600">
            +{order.items.length - 2} more item(s)
          </Text>
        )}
      </View>

      {/* Footer */}
      <View className="flex-row items-center justify-between pt-3">
        <div>
          <Text className="text-[10px] font-bold text-slate-400 uppercase">
            Total ({itemsCount} units)
          </Text>
          <Text className="text-base font-black text-primary-800">
            {currencyFormatter.format(order.totalAmount || order.total || 0)}
          </Text>
        </div>

        <View className="flex-row items-center gap-2">
          {order.paymentMethod ? (
            <View className="rounded-lg bg-slate-100 px-2 py-1">
              <Text className="text-[10px] font-black uppercase text-slate-600">
                {order.paymentMethod}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
