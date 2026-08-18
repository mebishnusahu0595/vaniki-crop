import React, { useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  SafeAreaView,
  Alert,
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
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setSelectedOrderIds([]);
      Alert.alert(
        'Payout Request Sent! 💰',
        'Your settlement request has been submitted to Super Admin finance team for direct bank transfer.'
      );
    },
    onError: (error: any) => {
      Alert.alert('Settlement Failed', error.message || 'Failed to request settlement.');
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

  const totalSelectedAmount = selectedOrderIds.reduce((sum, id) => {
    const order = eligibleOrders.find(o => o.id === id);
    return sum + (order?.totalAmount || 0);
  }, 0);

  const totalEligibleAmount = eligibleOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
  const isAllSelected = eligibleOrders.length > 0 && selectedOrderIds.length === eligibleOrders.length;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* ─── Wallet Overview Card ───────────────────────────────────────────── */}
      <View className="bg-white p-4 border-b border-slate-100 shadow-xs">
        <View className="rounded-3xl bg-gradient-to-br bg-[#143D2E] p-5 shadow-lg shadow-emerald-950/20">
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-emerald-300">
              Dealer Settlement Wallet
            </Text>
            <View className="rounded-full bg-emerald-800/80 px-2.5 py-1">
              <Text className="text-[10px] font-bold text-emerald-200">Direct Bank Payout</Text>
            </View>
          </View>

          <Text className="mt-3 text-3xl font-black text-white">
            {currencyFormatter.format(totalEligibleAmount)}
          </Text>
          <Text className="text-xs font-semibold text-emerald-300 mt-1">
            Available across {eligibleOrders.length} delivered & confirmed orders
          </Text>
        </View>

        {/* Selection bar */}
        <View className="mt-3 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={selectAll}
            disabled={eligibleOrders.length === 0}
            className="flex-row items-center rounded-xl bg-slate-100 px-3.5 py-2 border border-slate-200 disabled:opacity-40"
          >
            <Icon 
              name={isAllSelected ? 'check-square' : 'square'} 
              size={15} 
              color="#143D2E" 
            />
            <Text className="ml-2 text-xs font-black uppercase tracking-wider text-slate-800">
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>

          <Text className="text-xs font-bold text-slate-400">
            {selectedOrderIds.length} of {eligibleOrders.length} selected
          </Text>
        </View>
      </View>

      {/* ─── Orders List ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#143D2E" />
          <Text className="mt-3 text-slate-400 font-bold text-xs">Loading settlement orders...</Text>
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
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-6 rounded-3xl bg-white border border-dashed border-slate-200">
              <Icon name="check-circle" size={40} color="#10b981" />
              <Text className="mt-4 font-black text-slate-800 text-base">All Caught Up!</Text>
              <Text className="mt-1 text-center text-xs text-slate-400">
                No pending delivered orders awaiting settlement.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isChecked = selectedOrderIds.includes(item.id);

            return (
              <TouchableOpacity
                onPress={() => toggleOrder(item.id)}
                activeOpacity={0.85}
                className={`mb-3.5 rounded-[1.75rem] border p-5 transition ${
                  isChecked 
                    ? 'border-emerald-700 bg-emerald-50/50 shadow-xs' 
                    : 'border-slate-100 bg-white shadow-xs'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View className={`h-6 w-6 rounded-lg items-center justify-center border ${
                      isChecked ? 'bg-[#143D2E] border-[#143D2E]' : 'border-slate-300 bg-white'
                    }`}>
                      {isChecked && <Icon name="check" size={14} color="#ffffff" />}
                    </View>

                    <View>
                      <Text className="text-base font-black text-slate-900 leading-tight">
                        {item.orderNumber}
                      </Text>
                      <Text className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        {formatDateTime(item.createdAt)}
                      </Text>
                    </View>
                  </View>

                  <Text className="text-base font-black text-emerald-800">
                    {currencyFormatter.format(item.totalAmount)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ─── Sticky Payout Claim Bar ───────────────────────────────────────── */}
      {selectedOrderIds.length > 0 && (
        <View className="absolute bottom-4 left-4 right-4 rounded-2xl bg-[#143D2E] p-4 flex-row items-center justify-between shadow-xl shadow-emerald-950/40">
          <View>
            <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
              Claim Settlement Payout
            </Text>
            <Text className="text-lg font-black text-white">
              {currencyFormatter.format(totalSelectedAmount)}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => createSettlementMutation.mutate(selectedOrderIds)}
            disabled={createSettlementMutation.isPending}
            className="rounded-xl bg-white px-5 py-2.5 active:bg-slate-100"
          >
            {createSettlementMutation.isPending ? (
              <ActivityIndicator size="small" color="#143D2E" />
            ) : (
              <Text className="text-xs font-black uppercase tracking-wider text-[#143D2E]">
                Submit Claim ({selectedOrderIds.length})
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
