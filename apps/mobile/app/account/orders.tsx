import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Screen } from '../../src/components/Screen';
import { storefrontApi } from '../../src/lib/api';
import { currencyFormatter } from '../../src/utils/format';
import { resolveMediaUrl } from '../../src/utils/media';
import { Skeleton } from '../../src/components/Skeleton';
import type { Order } from '../../src/types/storefront';

const STATUS_COLORS: Record<string, string> = {
  placed: '#F59E0B',
  confirmed: '#3B82F6',
  processing: '#8B5CF6',
  shipped: '#06B6D4',
  delivered: '#10B981',
  cancelled: '#EF4444',
};

const STATUS_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  placed: 'shopping-bag',
  confirmed: 'check-circle',
  processing: 'refresh-cw',
  shipped: 'truck',
  delivered: 'package',
  cancelled: 'x-circle',
};

function getItemImage(item: Order['items'][number]) {
  const product = typeof item.productId === 'object' ? item.productId : null;
  const imageUrl = product?.images?.[0]?.url || item.image;
  const publicId = product?.images?.[0]?.publicId;
  return imageUrl ? resolveMediaUrl(imageUrl, publicId) : '';
}

function formatOrderDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTimelineDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function OrderDetailPopup({ order, onClose }: { order: Order | null; onClose: () => void }) {
  if (!order) return null;

  const statusColor = STATUS_COLORS[order.status] || '#A3B8B0';
  const timeline = [...(order.statusHistory || [])].reverse();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="max-h-[85%] rounded-t-[32px] bg-[#f4f8f6]">
          {/* Grab handle + header */}
          <View className="items-center pt-3 pb-1">
            <View className="h-1.5 w-12 rounded-full bg-primary-900/15" />
          </View>
          <View className="flex-row items-center justify-between px-6 pb-3 pt-2">
            <View className="flex-1 pr-3">
              <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-primary-500">
                Order #{order.orderNumber}
              </Text>
              <Text className="mt-0.5 text-2xl font-black text-primary-900">
                {currencyFormatter.format(order.totalAmount)}
              </Text>
            </View>
            <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: `${statusColor}20` }}>
              <Text className="text-[10px] font-black uppercase tracking-[1px]" style={{ color: statusColor }}>
                {order.status}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="ml-3 h-9 w-9 items-center justify-center rounded-full bg-white border border-primary-100 active:scale-90"
            >
              <Feather name="x" size={16} color="#082018" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
            {/* Status Timeline */}
            <View className="rounded-[24px] bg-white border border-primary-100 p-5 mb-4">
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500 mb-4">Order Status</Text>
              {timeline.length ? (
                <View>
                  {timeline.map((entry, index) => {
                    const color = STATUS_COLORS[entry.status] || '#A3B8B0';
                    return (
                      <View key={`${entry.status}-${entry.timestamp}`} className="flex-row gap-3">
                        <View className="items-center">
                          <View
                            className="h-8 w-8 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${color}20` }}
                          >
                            <Feather name={STATUS_ICONS[entry.status] || 'circle'} size={14} color={color} />
                          </View>
                          {index < timeline.length - 1 ? (
                            <View className="w-px flex-1 bg-primary-100 my-1" />
                          ) : null}
                        </View>
                        <View className="flex-1 pb-5">
                          <Text className="text-xs font-black uppercase tracking-[1px] text-primary-900">
                            {entry.status}
                          </Text>
                          <Text className="mt-0.5 text-[11px] font-bold text-primary-900/50">
                            {formatTimelineDate(entry.timestamp)}
                          </Text>
                          {entry.note ? (
                            <Text className="mt-0.5 text-[11px] leading-4 text-primary-900/60">{entry.note}</Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text className="text-xs text-primary-900/50">
                  Placed on {formatTimelineDate(order.createdAt)}
                </Text>
              )}
            </View>

            {/* Items */}
            <View className="rounded-[24px] bg-white border border-primary-100 p-5 mb-4">
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500 mb-4">
                Items ({order.items.length})
              </Text>
              <View className="gap-3">
                {order.items.map((item, index) => {
                  const imageUrl = getItemImage(item);
                  return (
                    <View key={`${item.productName}-${index}`} className="flex-row items-center gap-3">
                      <View className="h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-[14px] border border-primary-50 bg-[#f0f4f2]">
                        {imageUrl ? (
                          <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                        ) : (
                          <Feather name="box" size={18} color="#A3B8B0" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-[13px] font-black text-primary-900" numberOfLines={1}>
                          {item.productName}
                        </Text>
                        <Text className="mt-0.5 text-[10px] font-black uppercase tracking-[1px] text-primary-500">
                          {item.qty} × {item.variantLabel}
                        </Text>
                      </View>
                      <Text className="text-[13px] font-black text-primary-900">
                        {currencyFormatter.format(item.price * item.qty)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Invoice-style Bill Summary */}
            <View className="rounded-[24px] bg-white border border-primary-100 p-5 mb-4">
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500 mb-4">Bill Summary</Text>
              <View className="gap-3">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-primary-900/60">Subtotal</Text>
                  <Text className="text-sm font-black text-primary-900">{currencyFormatter.format(order.subtotal)}</Text>
                </View>
                {order.couponDiscount > 0 ? (
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-emerald-700">
                      Coupon Discount{order.couponCode ? ` (${order.couponCode})` : ''}
                    </Text>
                    <Text className="text-sm font-black text-emerald-700">
                      − {currencyFormatter.format(order.couponDiscount)}
                    </Text>
                  </View>
                ) : null}
                <View className="flex-row justify-between">
                  <Text className="text-sm text-primary-900/60">Delivery Charge</Text>
                  <Text className="text-sm font-black text-primary-900">
                    {order.serviceMode === 'pickup' ? 'Free (Store)' : currencyFormatter.format(order.deliveryCharge || 0)}
                  </Text>
                </View>
                <View className="mt-1 flex-row justify-between border-t border-primary-100 pt-3">
                  <Text className="text-sm font-black text-primary-900">Total</Text>
                  <Text className="text-base font-black text-primary-900">
                    {currencyFormatter.format(order.totalAmount)}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-primary-900/50">Payment</Text>
                  <Text className="text-xs font-bold text-primary-900/70">
                    {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid Online'} · {order.paymentStatus}
                  </Text>
                </View>
              </View>
            </View>

            {/* Full details (invoice download lives there) */}
            <Pressable
              onPress={() => {
                onClose();
                router.push({ pathname: '/order/[id]', params: { id: order.id } } as any);
              }}
              className="flex-row items-center justify-center gap-2 rounded-full bg-primary-500 px-5 py-4 active:scale-[0.98]"
            >
              <Feather name="file-text" size={14} color="#fff" />
              <Text className="text-xs font-black uppercase tracking-[1.5px] text-white">
                Full Details & Invoice
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function OrdersHistoryScreen() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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
            <View key={i} className="mb-4 rounded-[24px] bg-white border border-primary-100 p-4 flex-row items-center gap-3">
              <Skeleton width={64} height={64} borderRadius={16} />
              <View className="flex-1 gap-2">
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
            renderItem={({ item }) => {
              const firstImage = item.items?.length ? getItemImage(item.items[0]) : '';
              const extraItems = (item.items?.length || 0) - 1;
              const statusColor = STATUS_COLORS[item.status] || '#A3B8B0';

              return (
                <Pressable
                  onPress={() => setSelectedOrder(item)}
                  className="mb-4 rounded-[24px] bg-white border border-primary-100 p-4 flex-row items-center gap-3 active:scale-[0.99] active:bg-slate-50/50"
                >
                  <View className="h-[64px] w-[64px] items-center justify-center overflow-hidden rounded-[16px] border border-primary-50 bg-[#f0f4f2]">
                    {firstImage ? (
                      <Image source={{ uri: firstImage }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                    ) : (
                      <Feather name="box" size={22} color="#A3B8B0" />
                    )}
                    {extraItems > 0 ? (
                      <View className="absolute bottom-0 right-0 rounded-tl-[10px] bg-primary-900/85 px-1.5 py-0.5">
                        <Text className="text-[9px] font-black text-white">+{extraItems}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View className="flex-1">
                    <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-primary-500">
                      Order #{item.orderNumber}
                    </Text>
                    <Text className="mt-0.5 text-[11px] font-bold text-primary-900/45" numberOfLines={1}>
                      {item.items?.[0]?.productName}
                      {extraItems > 0 ? ` +${extraItems} more` : ''}
                    </Text>
                    <Text className="mt-1 text-lg font-black text-primary-900">
                      {currencyFormatter.format(item.totalAmount)}
                    </Text>
                    <View className="mt-1.5 flex-row items-center gap-2">
                      <View className="flex-row items-center gap-1.5 rounded-full px-2 py-1" style={{ backgroundColor: `${statusColor}18` }}>
                        <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                        <Text className="text-[10px] font-black uppercase tracking-[0.5px]" style={{ color: statusColor }}>
                          {item.status}
                        </Text>
                      </View>
                      <Text className="text-[10px] font-bold text-primary-900/40">
                        {formatOrderDate(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color="#A3B8B0" />
                </Pressable>
              );
            }}
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

      <OrderDetailPopup order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </Screen>
  );
}
