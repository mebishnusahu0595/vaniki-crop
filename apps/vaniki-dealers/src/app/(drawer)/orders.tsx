import React, { useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  Modal, 
  ScrollView, 
  ActivityIndicator, 
  RefreshControl,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../utils/api';
import { currencyFormatter, formatDateTime, formatAddress } from '../../utils/format';
import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import type { Order } from '../../types/admin';

const Icon = Feather as any;

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Placed', value: 'placed' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function OrdersScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusNote, setStatusNote] = useState('');

  // Fetch orders
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-orders', statusFilter, search],
    queryFn: () => adminApi.orders({ 
      status: statusFilter || undefined, 
      search: search || undefined,
      limit: 100 
    }),
  });

  // Mutate order status
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) => 
      adminApi.updateOrderStatus(id, { status, note }),
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setSelectedOrder(updatedOrder);
      setStatusNote('');
      Alert.alert('Status Updated ✅', `Order status changed to ${updatedOrder.status.toUpperCase()}`);
    },
    onError: (error: any) => {
      Alert.alert('Update Failed', error.message || 'Failed to update order status.');
    }
  });

  const handleUpdateStatus = (nextStatus: string) => {
    if (!selectedOrder) return;
    updateStatusMutation.mutate({
      id: selectedOrder.id,
      status: nextStatus,
      note: statusNote || undefined
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'placed': return { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'Placed' };
      case 'confirmed': return { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', label: 'Confirmed' };
      case 'processing': return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Processing' };
      case 'shipped': return { bg: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-700', label: 'In Transit' };
      case 'delivered': return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Delivered' };
      case 'cancelled': return { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: 'Cancelled' };
      default: return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', label: status };
    }
  };

  const orders = data?.data || [];

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* ─── Search & Status Filters ────────────────────────────────────────── */}
      <View className="bg-white px-4 pt-3 pb-3 border-b border-slate-100 shadow-xs">
        <View className="flex-row items-center bg-slate-100 rounded-2xl px-4 py-2.5">
          <Icon name="search" size={17} color="#059669" />
          <TextInput
            placeholder="Search by Order #, customer name, mobile..."
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

        {/* Status Pills */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          className="flex-row mt-3"
        >
          <View className="flex-row gap-2 pr-6">
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                onPress={() => setStatusFilter(opt.value)}
                className={`px-4 py-2 rounded-full border ${
                  statusFilter === opt.value 
                    ? 'bg-[#143D2E] border-[#143D2E]' 
                    : 'bg-white border-slate-200'
                }`}
              >
                <Text 
                  className={`font-black text-xs uppercase tracking-wider ${
                    statusFilter === opt.value ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ─── Orders List ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#143D2E" />
          <Text className="mt-3 text-slate-400 font-bold text-xs">Loading orders...</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={['#143D2E']} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-6 rounded-3xl bg-white border border-dashed border-slate-200">
              <Icon name="shopping-bag" size={40} color="#94a3b8" />
              <Text className="mt-4 font-black text-slate-800 text-base">No orders found</Text>
              <Text className="mt-1 text-center text-xs text-slate-400">
                {statusFilter ? `No ${statusFilter} orders matching your criteria.` : 'New bookings from farmers will appear here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
            const totalItemsCount = item.items?.reduce((sum, it) => sum + it.qty, 0) || 0;

            return (
              <TouchableOpacity
                onPress={() => setSelectedOrder(item)}
                activeOpacity={0.9}
                className="mb-4 rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-xs active:scale-[0.99]"
              >
                {/* Top Row: Order Number & Status */}
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-base font-black text-slate-900 leading-none">
                      {item.orderNumber}
                    </Text>
                    <Text className="text-[11px] font-semibold text-slate-400 mt-1">
                      {formatDateTime(item.createdAt)}
                    </Text>
                  </View>

                  <View className={`rounded-full px-3 py-1 border ${badge.bg}`}>
                    <Text className={`text-[10px] font-black uppercase tracking-wider ${badge.text}`}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                {/* Middle: Customer & Items Summary */}
                <View className="mt-4 border-t border-slate-50 pt-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <View className="h-8 w-8 rounded-full bg-emerald-50 items-center justify-center">
                        <Icon name="user" size={14} color="#059669" />
                      </View>
                      <View>
                        <Text className="text-xs font-bold text-slate-800">
                          {item.userId?.name || 'Customer'}
                        </Text>
                        <Text className="text-[10px] font-semibold text-slate-400">
                          {item.userId?.mobile || 'No phone'}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end">
                      <Text className="text-base font-black text-emerald-800">
                        {currencyFormatter.format(item.totalAmount)}
                      </Text>
                      <Text className="text-[10px] font-bold text-slate-400">
                        {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Bottom Badges */}
                <View className="mt-3 flex-row items-center gap-2 border-t border-slate-50 pt-3">
                  <View className={`rounded-full px-2.5 py-0.5 ${
                    item.paymentStatus === 'paid' ? 'bg-emerald-100' : 'bg-amber-100'
                  }`}>
                    <Text className={`text-[9px] font-black uppercase tracking-wider ${
                      item.paymentStatus === 'paid' ? 'text-emerald-800' : 'text-amber-800'
                    }`}>
                      {item.paymentStatus === 'paid' ? 'Paid' : 'Payment Due'}
                    </Text>
                  </View>

                  <View className="rounded-full bg-slate-100 px-2.5 py-0.5">
                    <Text className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                      {item.paymentMethod === 'cod' ? 'COD' : 'Online'}
                    </Text>
                  </View>

                  <View className="ml-auto flex-row items-center gap-1">
                    <Text className="text-xs font-bold text-emerald-700">Manage</Text>
                    <Icon name="chevron-right" size={14} color="#047857" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ─── Order Detail & Progression Modal ──────────────────────────────── */}
      <Modal
        visible={!!selectedOrder}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View className="flex-1 justify-end bg-slate-950/60">
          <View className="max-h-[85%] rounded-t-[2.5rem] bg-white p-6 shadow-2xl">
            {selectedOrder && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="flex-row items-center justify-between pb-4 border-b border-slate-100">
                  <View>
                    <Text className="text-xs font-black uppercase tracking-[2px] text-emerald-800">
                      Order Management
                    </Text>
                    <Text className="text-lg font-black text-slate-900 mt-0.5">
                      {selectedOrder.orderNumber}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedOrder(null)}
                    className="rounded-full bg-slate-100 p-2"
                  >
                    <Icon name="x" size={16} color="#475569" />
                  </TouchableOpacity>
                </View>

                {/* Customer Contact Card */}
                <View className="mt-4 rounded-2xl bg-emerald-50/50 p-4 border border-emerald-100/50">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-sm font-black text-slate-900">
                        {selectedOrder.userId?.name || 'Customer'}
                      </Text>
                      <Text className="text-xs font-bold text-slate-500 mt-0.5">
                        {selectedOrder.userId?.mobile || 'No contact provided'}
                      </Text>
                    </View>

                    {selectedOrder.userId?.mobile ? (
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => Linking.openURL(`tel:${selectedOrder.userId?.mobile}`)}
                          className="h-10 w-10 rounded-full bg-emerald-700 items-center justify-center shadow-xs"
                        >
                          <Icon name="phone" size={16} color="#ffffff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => Linking.openURL(`https://wa.me/91${selectedOrder.userId?.mobile}`)}
                          className="h-10 w-10 rounded-full bg-green-600 items-center justify-center shadow-xs"
                        >
                          <Icon name="message-circle" size={16} color="#ffffff" />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>

                  {selectedOrder.shippingAddress ? (
                    <Text className="text-xs text-slate-600 mt-2 font-medium">
                      📍 {formatAddress(selectedOrder.shippingAddress)}
                    </Text>
                  ) : null}
                </View>

                {/* Items Breakdown */}
                <View className="mt-5">
                  <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                    Ordered Formulations
                  </Text>
                  {selectedOrder.items?.map((item, idx) => (
                    <View
                      key={idx}
                      className="mb-2 flex-row items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100"
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-sm font-black text-slate-800" numberOfLines={1}>
                          {item.productName}
                        </Text>
                        <Text className="text-xs font-semibold text-slate-400 mt-0.5">
                          {item.variantLabel} × {item.qty} units
                        </Text>
                      </View>
                      <Text className="text-sm font-black text-emerald-800">
                        {currencyFormatter.format(item.price * item.qty)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Status Progression Actions */}
                <View className="mt-6 border-t border-slate-100 pt-4">
                  <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                    Update Order Status
                  </Text>

                  {/* Status buttons */}
                  <View className="flex-row flex-wrap gap-2">
                    {[
                      { status: 'confirmed', label: 'Confirm Order', bg: 'bg-indigo-600' },
                      { status: 'processing', label: 'Processing', bg: 'bg-amber-600' },
                      { status: 'shipped', label: 'Mark Dispatched', bg: 'bg-cyan-600' },
                      { status: 'delivered', label: 'Mark Delivered', bg: 'bg-emerald-700' },
                      { status: 'cancelled', label: 'Cancel Order', bg: 'bg-rose-600' },
                    ].map((btn) => (
                      <TouchableOpacity
                        key={btn.status}
                        onPress={() => handleUpdateStatus(btn.status)}
                        disabled={updateStatusMutation.isPending || selectedOrder.status === btn.status}
                        className={`rounded-xl px-4 py-2.5 ${
                          selectedOrder.status === btn.status ? 'bg-slate-200 opacity-50' : btn.bg
                        } active:scale-95`}
                      >
                        <Text className="text-xs font-black uppercase tracking-wider text-white">
                          {btn.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
