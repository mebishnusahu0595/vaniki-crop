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
  { key: '', label: 'All Requests' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'fulfilled', label: 'Fulfilled' },
];

export default function DealerOrdersScreen() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Queries for Stock Requests
  const requestsQuery = useQuery({
    queryKey: ['dealer-product-requests', selectedStatus],
    queryFn: () => dealerApi.getProductRequests({ status: selectedStatus || undefined, limit: 50 }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dealer-product-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['dealer-invoices'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const requests = requestsQuery.data?.data || [];

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="bg-white border-b border-primary-100 px-4 pt-3 pb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">
            B2B Procurement
          </Text>
          <Text className="text-xl font-black text-primary-900 leading-tight mt-0.5">
            Stock Requests
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/product-request' as any)}
          style={{ backgroundColor: '#1B4332' }}
          className="rounded-full px-3.5 py-2 flex-row items-center gap-1.5 active:scale-95 shadow-xs"
        >
          <Icon name="plus" size={14} color="#FFFFFF" />
          <Text className="text-xs font-black text-white">New Request</Text>
        </Pressable>
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

      {/* Requests List */}
      {requestsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#2D6A4F" />
          <Text className="mt-3 text-xs font-bold text-slate-500">Loading stock requests...</Text>
        </View>
      ) : requests.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <View className="w-16 h-16 rounded-full bg-primary-50 items-center justify-center mb-3">
            <Icon name="clipboard" size={32} color="#2D6A4F" />
          </View>
          <Text className="text-base font-black text-slate-800 text-center">No Stock Requests Found</Text>
          <Text className="text-xs font-semibold text-slate-500 text-center mt-1">
            Request stock petis from products or catalogue. SuperAdmin will review and generate your Tally tax invoice.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/products')}
            style={{ backgroundColor: '#1B4332' }}
            className="mt-5 rounded-full px-6 py-3 active:scale-95"
          >
            <Text className="text-xs font-black uppercase tracking-wider text-white">
              Browse Wholesale Products →
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id || item._id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 110 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D6A4F" />
          }
          renderItem={({ item }) => {
            const isApproved = item.status === 'approved';
            const isPending = item.status === 'pending';
            const isFulfilled = item.status === 'fulfilled';
            const isRejected = item.status === 'rejected';

            const pQty = Number(item.petiQuantity || 1);
            const pSize = Number(item.petiSize || 10);
            const totalUnits = Number(item.requestedQuantity || (pQty * pSize) || pQty);
            const unitPrice = Number(item.offerPrice || item.dealerPrice || 0);
            const estTotal = totalUnits * unitPrice;

            return (
              <View className="rounded-2xl border border-primary-100 bg-white p-4 shadow-soft">
                {/* Header */}
                <View className="flex-row items-start justify-between pb-3 border-b border-slate-100">
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-black text-primary-950">
                      {item.productName}
                    </Text>
                    {item.requestedPack ? (
                      <Text className="text-xs font-bold text-slate-500 mt-0.5">
                        Pack: {item.requestedPack}
                      </Text>
                    ) : null}
                    {item.garageName ? (
                      <Text className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        Warehouse: {item.garageName}
                      </Text>
                    ) : null}
                  </View>

                  {/* Status Badge */}
                  <View
                    className={`rounded-full px-3 py-1 border ${
                      isApproved
                        ? 'bg-emerald-50 border-emerald-300'
                        : isPending
                        ? 'bg-amber-50 border-amber-300'
                        : isFulfilled
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-rose-50 border-rose-300'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-black uppercase tracking-wider ${
                        isApproved
                          ? 'text-emerald-800'
                          : isPending
                          ? 'text-amber-800'
                          : isFulfilled
                          ? 'text-blue-800'
                          : 'text-rose-800'
                      }`}
                    >
                      {isApproved ? '✓ APPROVED' : isPending ? '⏳ PENDING' : item.status}
                    </Text>
                  </View>
                </View>

                {/* Units & Amount */}
                <View className="flex-row items-center justify-between py-3">
                  <View>
                    <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Quantity
                    </Text>
                    <Text className="text-sm font-black text-slate-900 mt-0.5">
                      {pQty} Peti ({totalUnits} Units)
                    </Text>
                  </View>

                  <View className="items-end">
                    <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Est. Taxable Value
                    </Text>
                    <Text className="text-sm font-black text-emerald-700 mt-0.5">
                      {currencyFormatter.format(estTotal)}
                    </Text>
                  </View>
                </View>

                {/* Footer Action / Notice */}
                {isApproved ? (
                  <View className="pt-2 border-t border-slate-100 flex-row items-center justify-between gap-2">
                    <Text className="text-[11px] font-bold text-emerald-800 flex-1">
                      🎉 Invoice generated with QR & bank details!
                    </Text>
                    <Pressable
                      onPress={() => router.push('/(tabs)/invoices')}
                      style={{ backgroundColor: '#1B4332' }}
                      className="rounded-xl px-3 py-2 flex-row items-center gap-1.5 active:scale-95"
                    >
                      <Icon name="file-text" size={13} color="#FFFFFF" />
                      <Text className="text-xs font-black text-white">View & Pay Invoice</Text>
                    </Pressable>
                  </View>
                ) : isPending ? (
                  <View className="pt-2 border-t border-slate-100">
                    <Text className="text-[11px] font-medium text-slate-400">
                      ⏳ Under review by SuperAdmin. You will be notified once approved.
                    </Text>
                  </View>
                ) : item.superAdminNote ? (
                  <View className="pt-2 border-t border-slate-100">
                    <Text className="text-[11px] font-semibold text-slate-600">
                      Note: {item.superAdminNote}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
