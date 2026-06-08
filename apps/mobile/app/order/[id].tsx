import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Screen } from '../../src/components/Screen';
import { storefrontApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { currencyFormatter, formatStoreAddress } from '../../src/utils/format';
import { resolveMediaUrl } from '../../src/utils/media';
import type { Product } from '../../src/types/storefront';
import { Skeleton } from '../../src/components/Skeleton';

function getOrderItemProduct(item: { productId: string | Product }) {
  return typeof item.productId === 'object' ? item.productId : null;
}

function getOrderItemImage(item: { image?: string; productId: string | Product }) {
  const product = getOrderItemProduct(item);
  const imageUrl = product?.images?.[0]?.url || item.image;
  const publicId = product?.images?.[0]?.publicId;
  return imageUrl ? resolveMediaUrl(imageUrl, publicId) : '';
}

const STATUS_COLORS: Record<string, string> = {
  placed: '#F59E0B',
  confirmed: '#3B82F6',
  processing: '#8B5CF6',
  shipped: '#06B6D4',
  delivered: '#10B981',
  cancelled: '#EF4444',
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const orderQuery = useQuery({
    queryKey: ['mobile-order-detail', id],
    queryFn: () => storefrontApi.orderDetail(id || ''),
    enabled: Boolean(id),
  });

  const order = orderQuery.data;

  const handleDownloadInvoice = async () => {
    if (!order) return;
    try {
      const url = storefrontApi.getInvoiceUrl(order.id);
      const token = useAuthStore.getState().token;
      const fileUri = `${FileSystem.documentDirectory}invoice-${order.orderNumber}.pdf`;

      const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (downloadRes.status !== 200) {
        throw new Error('Failed to download invoice');
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadRes.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Invoice - ${order.orderNumber}`,
        });
      } else {
        Alert.alert('Download Complete', `Invoice saved to ${downloadRes.uri}`);
      }
    } catch (caughtError) {
      Alert.alert('Download failed', caughtError instanceof Error ? caughtError.message : 'Please try again.');
    }
  };

  return (
    <Screen>
      {/* Back Button & Title */}
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-row items-center gap-3 flex-1">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-primary-50 active:scale-90"
          >
            <Feather name="arrow-left" size={18} color="#082018" />
          </Pressable>
          <Text className="text-xl font-black text-primary-900" numberOfLines={1}>
            {order ? `Order #${order.orderNumber}` : 'Order Details'}
          </Text>
        </View>
        {order && (
          <Pressable
            onPress={handleDownloadInvoice}
            className="flex-row items-center gap-1.5 rounded-2xl bg-primary-50 border border-primary-100 px-3 py-2.5 active:scale-95 active:opacity-90"
          >
            <Feather name="download" size={14} color="#143D2E" />
            <Text className="text-[10px] font-black uppercase tracking-[1px] text-primary-900">Invoice</Text>
          </Pressable>
        )}
      </View>

      {orderQuery.isLoading ? (
        <View className="flex-1">
          {/* Skeleton Summary Card */}
          <View className="rounded-[28px] bg-white border border-primary-100 p-5 mb-4 gap-4">
            <View className="flex-row items-center justify-between">
              <View className="gap-2 flex-1">
                <Skeleton width={80} height={10} borderRadius={4} />
                <Skeleton width={140} height={24} borderRadius={4} className="mt-1" />
              </View>
              <Skeleton width={70} height={24} borderRadius={12} />
            </View>
            <View className="mt-2 pt-4 border-t border-primary-50 flex-row gap-6">
              <View className="gap-2">
                <Skeleton width={50} height={10} borderRadius={4} />
                <Skeleton width={70} height={12} borderRadius={4} className="mt-1" />
              </View>
              <View className="gap-2">
                <Skeleton width={30} height={10} borderRadius={4} />
                <Skeleton width={50} height={12} borderRadius={4} className="mt-1" />
              </View>
              <View className="gap-2">
                <Skeleton width={30} height={10} borderRadius={4} />
                <Skeleton width={60} height={12} borderRadius={4} className="mt-1" />
              </View>
            </View>
          </View>

          {/* Skeleton Items List */}
          <View className="rounded-[28px] bg-white border border-primary-100 p-5 mb-4 gap-4">
            <Skeleton width={100} height={10} borderRadius={4} />
            {[1, 2].map((i) => (
              <View key={i} className="flex-row gap-3 rounded-[20px] border border-primary-50 bg-[#f8faf9] p-3">
                <Skeleton width={80} height={80} borderRadius={16} />
                <View className="flex-1 gap-2">
                  <Skeleton width="100%" height={14} borderRadius={4} />
                  <Skeleton width={120} height={10} borderRadius={4} />
                  <Skeleton width={80} height={14} borderRadius={4} className="mt-1" />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : !order ? (
        <View className="rounded-[28px] bg-white border border-primary-100 p-8 items-center">
          <Feather name="alert-circle" size={48} color="#A3B8B0" />
          <Text className="mt-4 text-lg font-black text-primary-900">Order not found</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Status & Summary Card */}
          <View className="rounded-[28px] bg-white border border-primary-100 p-5 mb-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-primary-500">
                  {order.orderNumber}
                </Text>
                <Text className="mt-1 text-2xl font-black text-primary-900">
                  {currencyFormatter.format(order.totalAmount)}
                </Text>
              </View>
              <View
                className="rounded-full px-3 py-1.5"
                style={{ backgroundColor: `${STATUS_COLORS[order.status] || '#A3B8B0'}20` }}
              >
                <Text
                  className="text-[10px] font-black uppercase tracking-[1px]"
                  style={{ color: STATUS_COLORS[order.status] || '#6B7280' }}
                >
                  {order.status}
                </Text>
              </View>
            </View>

            <View className="mt-4 pt-4 border-t border-primary-50 flex-row gap-6">
              <View>
                <Text className="text-[10px] font-black uppercase tracking-[1px] text-primary-900/40">Payment</Text>
                <Text className="mt-1 text-xs font-bold text-primary-900">
                  {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online'}
                </Text>
              </View>
              <View>
                <Text className="text-[10px] font-black uppercase tracking-[1px] text-primary-900/40">Mode</Text>
                <Text className="mt-1 text-xs font-bold text-primary-900 capitalize">{order.serviceMode}</Text>
              </View>
              <View>
                <Text className="text-[10px] font-black uppercase tracking-[1px] text-primary-900/40">Date</Text>
                <Text className="mt-1 text-xs font-bold text-primary-900">
                  {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            </View>
          </View>



          {/* Items List */}
          <View className="rounded-[28px] bg-white border border-primary-100 p-5 mb-4 shadow-sm">
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500 mb-4">Items Ordered</Text>
            <View className="gap-3">
              {order.items.map((item, index) => {
                const product = getOrderItemProduct(item);
                const imageUrl = getOrderItemImage(item);
                const description = product?.shortDescription || '';

                return (
                  <Pressable
                    key={`${(typeof item.productId === 'object' ? (item.productId as any)?.id : item.productId) || index}-${index}`}
                    onPress={() => product?.slug && router.push(`/product/${product.slug}` as any)}
                    disabled={!product?.slug}
                    className="flex-row gap-3 rounded-[20px] border border-primary-50 bg-[#f8faf9] p-3 active:scale-[0.99] active:opacity-90"
                  >
                    <View className="h-[80px] w-[80px] rounded-[16px] bg-[#f0f4f2] overflow-hidden items-center justify-center border border-primary-50">
                      {imageUrl ? (
                        <Image
                          source={{ uri: imageUrl }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="contain"
                        />
                      ) : (
                        <Feather name="box" size={24} color="#A3B8B0" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-black text-primary-900" numberOfLines={2}>{item.productName}</Text>
                      <Text className="mt-0.5 text-[10px] font-black uppercase tracking-[1px] text-primary-500">
                        {item.qty} × {item.variantLabel}
                      </Text>
                      {description ? (
                        <Text numberOfLines={1} className="mt-1 text-[11px] leading-4 text-primary-900/55">{description}</Text>
                      ) : null}
                      <Text className="mt-2 text-sm font-black text-primary-700">
                        {currencyFormatter.format(item.price * item.qty)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Order Summary */}
          <View className="rounded-[28px] bg-white border border-primary-100 p-5 mb-4 shadow-sm">
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500 mb-4">Bill Summary</Text>
            <View className="gap-3">
              <View className="flex-row justify-between">
                <Text className="text-sm text-primary-900/60">Subtotal</Text>
                <Text className="text-sm font-black text-primary-900">{currencyFormatter.format(order.subtotal)}</Text>
              </View>
              {order.couponDiscount > 0 ? (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-emerald-700">Coupon Discount</Text>
                  <Text className="text-sm font-black text-emerald-700">− {currencyFormatter.format(order.couponDiscount)}</Text>
                </View>
              ) : null}
              <View className="flex-row justify-between">
                <Text className="text-sm text-primary-900/60">Delivery Charge</Text>
                <Text className="text-sm font-black text-primary-900">
                  {order.serviceMode === 'pickup' ? 'Free (Pickup)' : currencyFormatter.format(order.deliveryCharge || 0)}
                </Text>
              </View>
              <View className="flex-row justify-between border-t border-primary-100 pt-3 mt-1">
                <Text className="text-sm font-black text-primary-900">Total Paid</Text>
                <Text className="text-base font-black text-primary-900">{currencyFormatter.format(order.totalAmount)}</Text>
              </View>
            </View>
          </View>

          {/* Delivery Address */}
          <View className="rounded-[28px] bg-white border border-primary-100 p-5 mb-4 shadow-sm">
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500 mb-3">
              {order.serviceMode === 'pickup' ? 'Pickup Location' : 'Delivery Address'}
            </Text>
            <Text className="text-sm leading-6 text-primary-900/70">
              {order.shippingAddress
                ? `${order.shippingAddress.name ? order.shippingAddress.name + ', ' : ''}${formatStoreAddress(order.shippingAddress)}`
                : order.storeId?.name
                ? `${order.storeId.name}${order.storeId.address ? ' — ' + formatStoreAddress(order.storeId.address) : ''}`
                : 'Pickup from selected store'}
            </Text>
          </View>

          {/* Status Timeline */}
          {order.statusHistory.length > 0 ? (
            <View className="rounded-[28px] bg-white border border-primary-100 p-5 shadow-sm">
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500 mb-4">Order Timeline</Text>
              <View className="gap-3">
                {[...order.statusHistory].reverse().map((entry, index) => (
                  <View key={`${entry.status}-${entry.timestamp}`} className="flex-row gap-3">
                    <View className="items-center">
                      <View
                        className="h-3 w-3 rounded-full mt-1"
                        style={{ backgroundColor: STATUS_COLORS[entry.status] || '#A3B8B0' }}
                      />
                      {index < order.statusHistory.length - 1 ? (
                        <View className="flex-1 w-px bg-primary-100 mt-1" />
                      ) : null}
                    </View>
                    <View className="flex-1 pb-2">
                      <Text className="text-xs font-black uppercase tracking-[1px] text-primary-900">{entry.status}</Text>
                      {entry.note ? (
                        <Text className="text-xs text-primary-900/60 mt-0.5">{entry.note}</Text>
                      ) : null}
                      <Text className="text-[10px] text-primary-900/40 mt-0.5">
                        {new Date(entry.timestamp).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
