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
  SafeAreaView
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../utils/api';
import { currencyFormatter, formatDateTime, formatAddress } from '../../utils/format';
import { Feather } from '@expo/vector-icons';
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
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Fetch orders from the server
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
      alert('Order status updated successfully!');
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to update order status.');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'placed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmed': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'processing': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'shipped': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'delivered': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-rose-50 text-rose-700 border-rose-100';
    }
  };

  const orders = data?.data || [];

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      {/* Search and Filters Bar */}
      <View className="bg-white px-4 pt-4 pb-3 border-b border-zinc-100 shadow-sm">
        <View className="flex-row items-center bg-zinc-100 rounded-2xl px-4 py-3">
          <Icon name="search" size={18} color="#71717A" />
          <TextInput
            placeholder="Search orders, number, phone..."
            placeholderTextColor="#A1A1AA"
            value={search}
            onChangeText={setSearch}
            className="flex-1 ml-2 text-zinc-900 font-semibold text-sm"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="x-circle" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Scrollable Status Filter Pills */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          className="flex-row mt-3 gap-2"
        >
          {STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.label}
              onPress={() => setStatusFilter(opt.value)}
              className={`px-4 py-2 rounded-full border ${
                statusFilter === opt.value 
                  ? 'bg-emerald-950 border-emerald-950' 
                  : 'bg-zinc-50 border-zinc-200'
              }`}
            >
              <Text 
                className={`font-black text-xs uppercase tracking-wider ${
                  statusFilter === opt.value ? 'text-white' : 'text-zinc-600'
                }`}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Orders List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#143D2E" />
          <Text className="mt-3 text-zinc-400 font-bold">Loading orders from server...</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl 
              refreshing={isFetching} 
              onRefresh={refetch} 
              colors={['#143D2E']} 
            />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center py-20">
              <Icon name="shopping-bag" size={48} color="#D4D4D8" />
              <Text className="text-zinc-500 font-black mt-4 uppercase tracking-widest text-xs">No Orders Found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedOrder(item)}
              className="bg-white border border-zinc-100 rounded-3xl p-5 mb-4 shadow-sm active:scale-[0.98] transition"
            >
              {/* Order Card Header */}
              <View className="flex-row justify-between items-start">
                <View>
                  <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Order Number</Text>
                  <Text className="text-zinc-900 font-black text-lg mt-0.5">{item.orderNumber}</Text>
                  <Text className="text-[10px] text-zinc-400 font-medium mt-1">
                    {formatDateTime(item.createdAt)}
                  </Text>
                </View>
                <View className="items-end">
                  <View className={`px-2.5 py-1 rounded-full border ${getStatusColor(item.status)}`}>
                    <Text className="text-[9px] font-black uppercase tracking-wider">{item.status}</Text>
                  </View>
                  <View className={`px-2 py-0.5 rounded-full border mt-2 ${getPaymentStatusColor(item.paymentStatus)}`}>
                    <Text className="text-[8px] font-black uppercase tracking-wider">{item.paymentStatus}</Text>
                  </View>
                </View>
              </View>

              <View className="h-px bg-zinc-100 my-4" />

              {/* Order Customer & Price */}
              <View className="flex-row justify-between items-center">
                <View className="flex-1 pr-2">
                  <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Customer</Text>
                  <Text className="text-zinc-800 font-black text-sm mt-0.5">{item.userId?.name || 'Customer'}</Text>
                  <Text className="text-xs text-zinc-500 font-bold mt-0.5">{item.userId?.mobile || '-'}</Text>

                  {/* Payment Method Badge */}
                  <View className="mt-2 flex-row items-center gap-1.5">
                    <View className={`rounded-lg px-2 py-0.5 border ${
                      item.paymentMethod === 'upi'
                        ? 'bg-emerald-50 border-emerald-200'
                        : item.paymentMethod === 'cash'
                        ? 'bg-slate-100 border-slate-200'
                        : 'bg-zinc-50 border-zinc-200'
                    }`}>
                      <Text className={`text-[9px] font-black uppercase ${
                        item.paymentMethod === 'upi' ? 'text-emerald-800' : 'text-slate-800'
                      }`}>
                        {item.paymentMethod === 'upi' ? '⚡ Paid via UPI QR' : item.paymentMethod === 'cash' ? '💵 Paid Cash' : item.paymentMethod}
                      </Text>
                    </View>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Total Price</Text>
                  <Text className="text-emerald-800 font-black text-lg mt-0.5">
                    {currencyFormatter.format(item.totalAmount)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Order Detail Modal */}
      <Modal
        visible={Boolean(selectedOrder)}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[2.5rem] h-[85%] border-t border-zinc-200 shadow-2xl">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center px-6 py-5 border-b border-zinc-100">
              <View className="flex-row items-center">
                <View className="bg-emerald-950 p-2.5 rounded-2xl text-white mr-3">
                  <Icon name="shopping-bag" size={18} color="#fff" />
                </View>
                <View>
                  <Text className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Order Details</Text>
                  <Text className="text-zinc-900 font-black text-base leading-none mt-1">
                    {selectedOrder?.orderNumber}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  setSelectedOrder(null);
                  setIsUpdatingStatus(false);
                }}
                className="bg-zinc-100 p-2 rounded-full"
              >
                <Icon name="x" size={20} color="#71717A" />
              </TouchableOpacity>
            </View>

            {/* Scrollable details */}
            <ScrollView contentContainerStyle={{ padding: 24 }} className="flex-1">
              {selectedOrder ? (
                <View className="space-y-6">
                  {/* Status & Summary Cards */}
                  <View className="flex-row justify-between">
                    <View className="w-[48%] rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
                      <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Order Status</Text>
                      <View className={`px-2 py-0.5 rounded-full border self-start mt-2 ${getStatusColor(selectedOrder.status)}`}>
                        <Text className="text-[9px] font-black uppercase tracking-wider">{selectedOrder.status}</Text>
                      </View>
                    </View>
                    <View className="w-[48%] rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
                      <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Payment Status</Text>
                      <View className={`px-2 py-0.5 rounded-full border self-start mt-2 ${getPaymentStatusColor(selectedOrder.paymentStatus)}`}>
                        <Text className="text-[9px] font-black uppercase tracking-wider">{selectedOrder.paymentStatus}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Customer Info Card */}
                  <View className="rounded-2xl border border-zinc-100 p-4 space-y-2 mt-4">
                    <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">Customer Info</Text>
                    <Text className="text-zinc-900 font-black text-sm">{selectedOrder.userId?.name || 'Guest User'}</Text>
                    <Text className="text-zinc-500 font-bold text-xs">Mobile: {selectedOrder.userId?.mobile || '-'}</Text>
                    <Text className="text-zinc-500 font-bold text-xs">Email: {selectedOrder.userId?.email || '-'}</Text>
                    {selectedOrder.shippingAddress && (
                      <View className="mt-2 pt-2 border-t border-zinc-100">
                        <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400 mb-1">Shipping Address</Text>
                        <Text className="text-zinc-600 text-xs font-semibold">{formatAddress(selectedOrder.shippingAddress)}</Text>
                      </View>
                    )}
                  </View>

                  {/* Items List */}
                  <View className="mt-4">
                    <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-3">Items Summary</Text>
                    {selectedOrder.items?.map((item, idx) => (
                      <View key={idx} className="flex-row justify-between items-center bg-zinc-50/50 border border-zinc-100 rounded-2xl p-4 mb-3">
                        <View className="flex-1 mr-3">
                          <Text className="text-zinc-900 font-black text-sm">{item.productName}</Text>
                          <Text className="text-zinc-500 font-bold text-xs mt-0.5">
                            {item.qty} × {item.variantLabel}
                          </Text>
                        </View>
                        <Text className="text-zinc-950 font-black text-sm">
                          {currencyFormatter.format(item.price * item.qty)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Pricing Breakdown */}
                  <View className="bg-emerald-950 rounded-3xl p-5 text-white shadow-xl mt-4">
                    <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-3">Bill Details</Text>
                    <View className="space-y-2">
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-zinc-300 font-semibold">Subtotal</Text>
                        <Text className="text-xs text-white font-bold">{currencyFormatter.format(selectedOrder.subtotal)}</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-zinc-300 font-semibold">Discount</Text>
                        <Text className="text-xs text-rose-300 font-bold">-{currencyFormatter.format(selectedOrder.couponDiscount)}</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-zinc-300 font-semibold">Delivery Charge</Text>
                        <Text className="text-xs text-white font-bold">{currencyFormatter.format(selectedOrder.deliveryCharge)}</Text>
                      </View>
                      <View className="h-px bg-white/10 my-2" />
                      <View className="flex-row justify-between items-center">
                        <Text className="text-sm text-emerald-400 font-black uppercase tracking-wider">Total Amount</Text>
                        <Text className="text-2xl font-black text-white">
                          {currencyFormatter.format(selectedOrder.totalAmount)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Order Status Action Sheet */}
                  <View className="mt-4 pt-4 border-t border-zinc-100">
                    <TouchableOpacity
                      onPress={() => setIsUpdatingStatus(!isUpdatingStatus)}
                      className="flex-row justify-between items-center bg-zinc-900 rounded-2xl py-4 px-5 active:scale-95"
                    >
                      <Text className="text-white font-black text-xs uppercase tracking-widest">Update Order Status</Text>
                      <Icon name={isUpdatingStatus ? 'chevron-up' : 'chevron-down'} size={16} color="#fff" />
                    </TouchableOpacity>

                    {isUpdatingStatus && (
                      <View className="mt-3 bg-zinc-50 border border-zinc-100 rounded-3xl p-4">
                        <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-2">Select Next Status</Text>
                        <View className="flex-row flex-wrap gap-2">
                          {['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((st) => (
                            <TouchableOpacity
                              key={st}
                              onPress={() => handleUpdateStatus(st)}
                              className="bg-white border border-zinc-200 px-3.5 py-2 rounded-xl shadow-sm active:bg-zinc-100"
                            >
                              <Text className="text-zinc-800 font-black text-[10px] uppercase tracking-wider">{st}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View className="mt-3 bg-white rounded-2xl border border-zinc-200 px-3 py-2.5">
                          <TextInput
                            placeholder="Add action note (optional)..."
                            placeholderTextColor="#A1A1AA"
                            value={statusNote}
                            onChangeText={setStatusNote}
                            className="text-zinc-800 text-xs font-semibold h-12"
                            multiline
                          />
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Status History Timeline */}
                  <View className="mt-4">
                    <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-3">Timeline History</Text>
                    {selectedOrder.statusHistory?.map((history, hidx) => (
                      <View key={hidx} className="flex-row items-start pb-4">
                        <View className="items-center mr-3 mt-1">
                          <View className="h-3 w-3 rounded-full bg-emerald-700" />
                          {hidx < selectedOrder.statusHistory.length - 1 && (
                            <View className="w-0.5 h-12 bg-emerald-100 my-1" />
                          )}
                        </View>
                        <View className="flex-1">
                          <View className="flex-row justify-between items-center">
                            <Text className="text-zinc-900 font-black text-xs uppercase tracking-wider">
                              {history.status}
                            </Text>
                            <Text className="text-[10px] text-zinc-400 font-bold">
                              {formatDateTime(history.timestamp)}
                            </Text>
                          </View>
                          {history.note && (
                            <Text className="text-xs text-zinc-500 italic mt-1 font-medium bg-zinc-100/60 p-2 rounded-xl">
                              "{history.note}"
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
