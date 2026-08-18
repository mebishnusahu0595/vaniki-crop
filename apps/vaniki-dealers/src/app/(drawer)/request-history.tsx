import React, { useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Modal, 
  ScrollView, 
  ActivityIndicator, 
  RefreshControl,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../utils/api';
import { formatDateTime } from '../../utils/format';
import { Feather } from '@expo/vector-icons';
import type { DealerProductRequest } from '../../types/admin';

const Icon = Feather as any;

const STATUS_FILTERS = [
  { label: 'All Requests', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Fulfilled', value: 'fulfilled' },
  { label: 'Rejected', value: 'rejected' },
];

export default function RequestHistoryScreen() {
  const [selectedRequest, setSelectedRequest] = useState<DealerProductRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-product-requests-history'],
    queryFn: () => adminApi.productRequests({ limit: 100 }),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Pending Factory Review' };
      case 'contacted': return { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'Factory Contacted' };
      case 'fulfilled': return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Dispatched / Fulfilled' };
      case 'rejected': return { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: 'Declined' };
      default: return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', label: status };
    }
  };

  const allRequests = data?.data || [];
  const filteredRequests = allRequests.filter((r) => {
    const matchStatus = !statusFilter || r.status === statusFilter;
    const matchSearch = !search || r.productName?.toLowerCase().includes(search.toLowerCase()) || r.garageName?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* ─── Search & Status Filters ────────────────────────────────────────── */}
      <View className="bg-white border-b border-slate-100 shadow-xs">
        <View className="px-4 pt-3 pb-2">
          <View className="flex-row items-center bg-slate-100 rounded-2xl px-4 py-2.5">
            <Icon name="search" size={17} color="#059669" />
            <TextInput
              placeholder="Search requested formulation, garage..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
              className="flex-1 ml-2 text-slate-900 font-semibold text-sm"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Icon name="x-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 pb-3 pt-1">
          <View className="flex-row gap-2 pr-6">
            {STATUS_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.label}
                onPress={() => setStatusFilter(f.value)}
                className={`px-4 py-2 rounded-full border ${
                  statusFilter === f.value
                    ? 'bg-[#143D2E] border-[#143D2E]'
                    : 'bg-white border-slate-200'
                }`}
              >
                <Text
                  className={`text-xs font-black uppercase tracking-wider ${
                    statusFilter === f.value ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ─── Requests List ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#143D2E" />
          <Text className="mt-3 text-slate-400 font-bold text-xs">Loading request history...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={['#143D2E']} />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-6 rounded-3xl bg-white border border-dashed border-slate-200">
              <Icon name="clock" size={40} color="#94a3b8" />
              <Text className="mt-4 font-black text-slate-800 text-base">No Requests Found</Text>
              <Text className="mt-1 text-center text-xs text-slate-400">
                Bulk product requisitions sent to factory superadmin will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);

            return (
              <TouchableOpacity
                onPress={() => setSelectedRequest(item)}
                activeOpacity={0.9}
                className="mb-4 rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-xs active:scale-[0.99]"
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-2">
                    <Text className="text-base font-black text-slate-900 leading-tight">
                      {item.productName}
                    </Text>
                    <Text className="text-xs font-bold text-emerald-800 mt-1">
                      {item.petiQuantity || item.requestedQuantity} Petis / Cartons
                      {item.requestedPack ? ` (${item.requestedPack})` : ''}
                    </Text>
                    <Text className="text-[11px] font-semibold text-slate-400 mt-1">
                      📍 {item.garageName || 'Central Hub'} · {formatDateTime(item.createdAt)}
                    </Text>
                  </View>

                  <View className={`rounded-full px-3 py-1 border ${badge.bg}`}>
                    <Text className={`text-[9px] font-black uppercase tracking-wider ${badge.text}`}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                {item.notes ? (
                  <View className="mt-3 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <Text className="text-xs text-slate-600 font-medium" numberOfLines={2}>
                      💬 Note: {item.notes}
                    </Text>
                  </View>
                ) : null}

                {item.superAdminNote ? (
                  <View className="mt-2 rounded-xl bg-emerald-50 p-2.5 border border-emerald-100">
                    <Text className="text-xs text-emerald-900 font-bold" numberOfLines={2}>
                      🏭 Factory Response: {item.superAdminNote}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ─── Details Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={Boolean(selectedRequest)}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedRequest(null)}
      >
        <View className="flex-1 justify-end bg-slate-950/60">
          <View className="rounded-t-[2.5rem] bg-white p-6 shadow-2xl">
            {selectedRequest && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row items-center justify-between pb-4 border-b border-slate-100">
                  <View>
                    <Text className="text-xs font-black uppercase tracking-[2px] text-emerald-800">
                      Requisition Details
                    </Text>
                    <Text className="text-lg font-black text-slate-900 mt-0.5">
                      {selectedRequest.productName}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedRequest(null)}
                    className="rounded-full bg-slate-100 p-2"
                  >
                    <Icon name="x" size={16} color="#475569" />
                  </TouchableOpacity>
                </View>

                <View className="mt-5 space-y-3">
                  <View className="flex-row justify-between rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                    <Text className="text-xs font-bold text-slate-500">Requested Quantity</Text>
                    <Text className="text-sm font-black text-slate-900">
                      {selectedRequest.petiQuantity || selectedRequest.requestedQuantity} Petis / Cases
                    </Text>
                  </View>

                  <View className="flex-row justify-between rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                    <Text className="text-xs font-bold text-slate-500">Packaging Size</Text>
                    <Text className="text-sm font-black text-slate-900">
                      {selectedRequest.requestedPack || 'Standard'}
                    </Text>
                  </View>

                  <View className="flex-row justify-between rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                    <Text className="text-xs font-bold text-slate-500">Destination Garage</Text>
                    <Text className="text-sm font-black text-slate-900">
                      {selectedRequest.garageName || 'Main Central Godown'}
                    </Text>
                  </View>

                  <View className="flex-row justify-between rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                    <Text className="text-xs font-bold text-slate-500">Requisition Date</Text>
                    <Text className="text-xs font-black text-slate-900">
                      {formatDateTime(selectedRequest.createdAt)}
                    </Text>
                  </View>
                </View>

                {selectedRequest.superAdminNote ? (
                  <View className="mt-4 rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
                    <Text className="text-xs font-black uppercase text-emerald-800">Factory Dispatch Update</Text>
                    <Text className="text-xs font-semibold text-emerald-950 mt-1">
                      {selectedRequest.superAdminNote}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={() => setSelectedRequest(null)}
                  className="mt-6 rounded-2xl bg-[#143D2E] py-3.5 items-center active:bg-emerald-900"
                >
                  <Text className="text-xs font-black uppercase tracking-wider text-white">Close Details</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
