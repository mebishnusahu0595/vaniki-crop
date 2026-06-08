import { useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import * as Notifications from 'expo-notifications';
import { staffApi, type DeliveryTask } from '../src/lib/staffApi';
import { useStaffAuthStore } from '../src/store/useStaffAuthStore';
import { currencyFormatter, formatDateTime } from '../src/utils/format';
import { resolveMediaUrl } from '../src/utils/media';
import { LoadingScreen } from '../src/components/LoadingScreen';

function customerName(task: DeliveryTask) {
  return task.shippingAddress?.name || task.userId?.name || 'Customer';
}

function customerMobile(task: DeliveryTask) {
  return task.shippingAddress?.mobile || task.userId?.mobile || '-';
}

function OrderCard({ task }: { task: DeliveryTask }) {
  return (
    <View className="rounded-[28px] bg-white p-5 border border-primary-50 shadow-sm">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">{task.orderNumber}</Text>
          <Text className="mt-2 text-xl font-black text-primary-900">{customerName(task)}</Text>
          <Text className="mt-1 text-sm font-semibold text-primary-900/60">{customerMobile(task)}</Text>
        </View>
        <View className="rounded-full bg-primary-50 px-3 py-2">
          <Text className="text-[10px] font-black uppercase tracking-[1px] text-primary-700">{task.status}</Text>
        </View>
      </View>

      <View className="mt-4 rounded-[22px] bg-primary-50/50 p-4">
        <Text className="text-[10px] font-black uppercase tracking-[1.6px] text-primary-500">Order Metadata</Text>
        <Text className="mt-2 text-sm text-primary-900 font-bold">
          Store: {task.storeId?.name || 'Unknown Store'}
        </Text>
        <Text className="mt-1 text-xs text-primary-900/60">
          Placed: {formatDateTime(task.createdAt)}
        </Text>
      </View>

      <View className="mt-4 gap-3">
        {(task.items ?? []).map((item, index) => (
          <View key={`${item.productId}-${index}`} className="flex-row items-center gap-3 rounded-[20px] border border-primary-100 p-3">
            {item.image ? (
              <Image source={{ uri: resolveMediaUrl(item.image) }} style={{ width: 48, height: 48, borderRadius: 14 }} />
            ) : (
              <View className="h-12 w-12 items-center justify-center rounded-[14px] bg-primary-50">
                <Feather name="package" size={18} color="#527164" />
              </View>
            )}
            <View className="flex-1">
              <Text className="text-sm font-black text-primary-900">{item.productName}</Text>
              <Text className="mt-1 text-xs text-primary-900/55">{item.variantLabel} · {item.qty} qty</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="mt-4 flex-row gap-3">
        <View className="flex-1 rounded-[20px] bg-emerald-50 p-3">
          <Text className="text-[10px] font-black uppercase tracking-[1px] text-emerald-700">Total Amount</Text>
          <Text className="mt-1 text-base font-black text-primary-900">{currencyFormatter.format(task.totalAmount)}</Text>
        </View>
        <View className="flex-1 rounded-[20px] bg-amber-50 p-3">
          <Text className="text-[10px] font-black uppercase tracking-[1px] text-amber-700">Payment Status</Text>
          <Text className="mt-1 text-base font-black text-primary-900">{(task.paymentMethod ?? '-').toUpperCase()} · {task.paymentStatus ?? '-'}</Text>
        </View>
      </View>
    </View>
  );
}

export default function SuperAdminOrdersScreen() {
  const { staff, token, hydrated, logout, setStaff } = useStaffAuthStore();
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ['superadmin-all-orders'],
    queryFn: staffApi.tasks,
    enabled: Boolean(token),
    refetchInterval: 15_000,
  });

  const sessionQuery = useQuery({
    queryKey: ['superadmin-session', token],
    queryFn: staffApi.me,
    enabled: Boolean(token),
    retry: 1,
  });

  useEffect(() => {
    if (sessionQuery.data) {
      setStaff(sessionQuery.data);
    }
  }, [sessionQuery.data, setStaff]);

  useEffect(() => {
    if (token) {
      Notifications.getDevicePushTokenAsync().then((deviceToken) => {
        if (deviceToken?.data) {
          staffApi.updateFcmToken(deviceToken.data).catch((err) => {
            console.error('Failed to update FCM token on backend:', err);
          });
        }
      }).catch((err) => {
        console.log('[PUSH] FCM token registration not supported on this platform/device:', err.message);
      });
    }
  }, [token]);

  const orders = useMemo(() => ordersQuery.data || [], [ordersQuery.data]);

  if (!hydrated) {
    return <LoadingScreen />;
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      <View className="flex-1">
        <FlashList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <OrderCard task={item} />}
          estimatedItemSize={350}
          contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
          showsVerticalScrollIndicator={false}
          onRefresh={() => ordersQuery.refetch()}
          refreshing={ordersQuery.isRefetching}
          ListHeaderComponent={
            <View>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-[11px] font-black uppercase tracking-[2px] text-primary-500">Superadmin Monitor</Text>
                  <Text className="mt-2 text-3xl font-black text-primary-900">{staff?.name || 'Superadmin'}</Text>
                  <Text className="mt-1 text-sm text-primary-900/60">System Monitoring Console</Text>
                </View>
                <Pressable
                  onPress={() => {
                    logout();
                    router.replace('/login' as never);
                  }}
                  className="h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm"
                >
                  <Feather name="log-out" size={20} color="#DC2626" />
                </Pressable>
              </View>

              <View className="mt-5 flex-row gap-3">
                <View className="flex-1 rounded-[24px] bg-primary-900 p-4">
                  <Text className="text-2xl font-black text-white">{orders.length}</Text>
                  <Text className="mt-1 text-[10px] font-black uppercase tracking-[1.5px] text-white/55">Total System Orders</Text>
                </View>
                <Pressable onPress={() => ordersQuery.refetch()} className="w-24 items-center justify-center rounded-[24px] bg-white border border-primary-50">
                  <Feather name="refresh-cw" size={20} color="#143D2E" />
                  <Text className="mt-1 text-[10px] font-black uppercase tracking-[1px] text-primary-900">Refresh</Text>
                </Pressable>
              </View>
              
              <View className="h-5" />
            </View>
          }
          ListEmptyComponent={
            ordersQuery.isLoading ? (
              <View className="rounded-[28px] bg-white p-8 border border-primary-50">
                <ActivityIndicator color="#2D6A4F" />
                <Text className="mt-4 text-center text-sm font-semibold text-primary-900/60">Loading system orders...</Text>
              </View>
            ) : (
              <View className="rounded-[28px] bg-white p-8 border border-primary-50">
                <Text className="text-center text-xl font-black text-primary-900">No orders found.</Text>
                <Text className="mt-2 text-center text-sm leading-6 text-primary-900/60">
                  Orders placed across the system will show up here.
                </Text>
              </View>
            )
          }
          ItemSeparatorComponent={() => <View className="h-5" />}
        />
      </View>
    </SafeAreaView>
  );
}
