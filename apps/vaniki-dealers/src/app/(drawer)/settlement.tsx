import React, { useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  SafeAreaView
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../utils/api';
import { currencyFormatter, formatDateTime } from '../../utils/format';
import { Feather } from '@expo/vector-icons';

const Icon = Feather as any;

export default function SettlementScreen() {
  const queryClient = useQueryClient();
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Fetch eligible delivered orders
  const { data: eligibleOrders = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-settlement-eligible'],
    queryFn: adminApi.getSettlementEligibleOrders,
  });

  // Create Settlement mutation
  const createSettlementMutation = useMutation({
    mutationFn: (ids: string[]) => adminApi.createSettlementRequest(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlement-eligible'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product-requests'] });
      setSelectedOrderIds([]);
      alert('Settlement request sent to Super Admin successfully!');
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to request settlement.');
    }
  });

  const toggleOrder = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(oId => oId !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedOrderIds.length === eligibleOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(eligibleOrders.map(o => o.id));
    }
  };

  const totalAmount = selectedOrderIds.reduce((sum, id) => {
    const order = eligibleOrders.find(o => o.id === id);
    return sum + (order?.totalAmount || 0);
  }, 0);

  const isAllSelected = eligibleOrders.length > 0 && selectedOrderIds.length === eligibleOrders.length;

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      
      {/* Top Header Selector Controls */}
      <View className="bg-white px-6 py-4 flex-row justify-between items-center border-b border-zinc-100 shadow-sm">
        <TouchableOpacity
          onPress={selectAll}
          disabled={eligibleOrders.length === 0}
          className="flex-row items-center bg-zinc-100 px-4 py-2 rounded-xl border border-zinc-200 active:scale-95 disabled:opacity-50"
        >
          <Icon 
            name={isAllSelected ? 'check-square' : 'square'} 
            size={16} 
            color="#3F3F46" 
          />
          <Text className="text-zinc-700 font-black text-xs uppercase tracking-wider ml-2">
            {isAllSelected ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>

        <Text className="text-zinc-400 font-bold text-xs">
          {eligibleOrders.length} Orders Eligible
        </Text>
      </View>

      {/* Eligible List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#143D2E" />
          <Text className="mt-3 text-zinc-400 font-bold">Loading eligible settlements...</Text>
        </View>
      ) : (
        <FlatList
          data={eligibleOrders}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl 
              refreshing={isFetching} 
              onRefresh={refetch} 
              colors={['#143D2E']} 
            />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center py-20">
              <Icon name="clock" size={48} color="#D4D4D8" />
              <Text className="text-zinc-500 font-black mt-4 uppercase tracking-widest text-xs">No settlements pending</Text>
            </View>
          }
          renderItem={({ item: order }) => {
            const isChecked = selectedOrderIds.includes(order.id);
            return (
              <TouchableOpacity
                onPress={() => toggleOrder(order.id)}
                className={`flex-row items-center border rounded-[2rem] p-5 mb-4 shadow-sm active:scale-[0.99] transition ${
                  isChecked 
                    ? 'border-emerald-700 bg-emerald-50/20' 
                    : 'border-zinc-100 bg-white hover:border-zinc-200'
                }`}
              >
                <View className="mr-4">
                  <Icon 
                    name={isChecked ? 'check-circle' : 'circle'} 
                    size={22} 
                    color={isChecked ? '#047857' : '#D4D4D8'} 
                  />
                </View>

                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center gap-1.5 flex-wrap">
                    <Text className="text-zinc-900 font-black text-base">{order.orderNumber}</Text>
                    <Text className="bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-200">
                      Delivered
                    </Text>
                  </View>
                  <Text className="text-xs text-zinc-500 font-bold mt-1">
                    {formatDateTime(order.createdAt)} · {order.items?.length || 0} Items
                  </Text>
                </View>

                <Text className="text-zinc-950 font-black text-base ml-2">
                  {currencyFormatter.format(order.totalAmount)}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Floating Bottom Claim Summary */}
      {selectedOrderIds.length > 0 && (
        <View className="absolute bottom-0 left-0 right-0 bg-zinc-900 px-6 py-5 border-t border-zinc-800 shadow-2xl rounded-t-[2.5rem]">
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Total Selection</Text>
              <Text className="text-white font-black text-sm mt-0.5">
                {selectedOrderIds.length} orders chosen
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Claim Amount</Text>
              <Text className="text-emerald-400 font-black text-xl mt-0.5">
                {currencyFormatter.format(totalAmount)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => createSettlementMutation.mutate(selectedOrderIds)}
            disabled={createSettlementMutation.isPending}
            className="w-full rounded-2xl bg-emerald-500 py-4 items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
          >
            {createSettlementMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-black text-xs uppercase tracking-[0.2em]">Request Settlement</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
}
