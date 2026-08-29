import { useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import * as Notifications from 'expo-notifications';
import { staffApi, type DeliveryTask } from '../src/lib/staffApi';
import { useStaffAuthStore } from '../src/store/useStaffAuthStore';
import { currencyFormatter } from '../src/utils/format';
import { resolveMediaUrl } from '../src/utils/media';
import { LoadingScreen } from '../src/components/LoadingScreen';

function customerName(task: DeliveryTask) {
  return task.shippingAddress?.name || task.userId?.name || 'Customer';
}

function customerMobile(task: DeliveryTask) {
  return task.shippingAddress?.mobile || task.userId?.mobile || '-';
}

function PickupCard({ task }: { task: DeliveryTask }) {
  const queryClient = useQueryClient();
  const staff = useStaffAuthStore((state) => state.staff);
  const [otp, setOtp] = useState('');
  const [isSendingOtpCode, setIsSendingOtpCode] = useState(false);
  const [upiModalVisible, setUpiModalVisible] = useState(false);
  const [txnId, setTxnId] = useState('');

  const staffUpiId = staff?.upiId || `${staff?.mobile || 'dealer'}@upi`;

  const handleSendOtp = async () => {
    setIsSendingOtpCode(true);
    try {
      await staffApi.sendPickupOtp(task.id);
      Alert.alert('Success', 'OTP sent to customer mobile number via Message Central.');
    } catch (error) {
      Alert.alert('Failed to send OTP', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSendingOtpCode(false);
    }
  };

  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: ['dealer-staff-pickups'] });

  const verifyMutation = useMutation({
    mutationFn: () => staffApi.verifyPickup(task.id, { otp }),
    onSuccess: () => {
      setOtp('');
      invalidateTasks();
      Alert.alert('Pickup Complete', 'Order picked up and marked as delivered.');
    },
    onError: (error) => Alert.alert('Verification failed', error instanceof Error ? error.message : 'Please check OTP and try again.'),
  });

  const collectPaymentMutation = useMutation({
    mutationFn: (method: 'cash' | 'upi') => staffApi.collectPayment(task.id, { method }),
    onSuccess: (_data, method) => {
      invalidateTasks();
      setUpiModalVisible(false);
      setTxnId('');
      Alert.alert('Payment Recorded 🎉', `Marked as paid via ${method.toUpperCase()} (${currencyFormatter.format(task.totalAmount)}).`);
    },
    onError: (error) => Alert.alert('Could not record payment', error instanceof Error ? error.message : 'Please try again.'),
  });

  const handleCashClick = () => {
    Alert.alert(
      'Collect Cash',
      `Collect cash payment of ${currencyFormatter.format(task.totalAmount)} from customer?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Cash Received',
          onPress: () => collectPaymentMutation.mutate('cash'),
        },
      ]
    );
  };

  const isPaid = task.paymentStatus === 'paid';

  const upiPaymentUri = `upi://pay?pa=${staffUpiId}&pn=${encodeURIComponent(
    staff?.name || 'Vaniki Store'
  )}&am=${task.totalAmount}&cu=INR&tn=Order_${task.orderNumber}`;

  const customQrUrl = staff?.qrCode || staff?.upiQrCode;
  const [activeQrTab, setActiveQrTab] = useState<'custom' | 'dynamic'>('custom');

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
          <Text className="text-[10px] font-black uppercase tracking-[1px] text-emerald-700">Amount</Text>
          <Text className="mt-1 text-base font-black text-primary-900">{currencyFormatter.format(task.totalAmount)}</Text>
        </View>
        <View className="flex-1 rounded-[20px] bg-amber-50 p-3">
          <Text className="text-[10px] font-black uppercase tracking-[1px] text-amber-700">Payment</Text>
          <Text className="mt-1 text-base font-black text-primary-900">{(task.paymentMethod ?? '-').toUpperCase()} · {task.paymentStatus ?? '-'}</Text>
        </View>
      </View>

      <View className="mt-4 rounded-[24px] border border-primary-100 p-4">
        <Text className="text-[10px] font-black uppercase tracking-[1.6px] text-primary-500">Payment Collection</Text>
        {isPaid ? (
          <View className="mt-3 flex-row items-center gap-2 rounded-[18px] bg-emerald-50 px-4 py-3">
            <Feather name="check-circle" size={18} color="#059669" />
            <Text className="text-sm font-black text-emerald-700">
              Paid · {(task.paymentMethod ?? '-').toUpperCase()}
            </Text>
          </View>
        ) : (
          <>
            <Text className="mt-1 text-xs text-primary-900/55">How did the customer pay?</Text>
            <View className="mt-3 flex-row gap-3">
              {/* Cash Button */}
              <Pressable
                onPress={handleCashClick}
                disabled={collectPaymentMutation.isPending}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-slate-800 px-4 py-3.5 active:scale-[0.98] disabled:opacity-60"
              >
                {collectPaymentMutation.isPending && collectPaymentMutation.variables === 'cash' ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Feather name="dollar-sign" size={15} color="#ffffff" />
                )}
                <Text className="text-[11px] font-black uppercase tracking-[1px] text-white">Cash</Text>
              </Pressable>

              {/* UPI QR Button */}
              <Pressable
                onPress={() => {
                  setActiveQrTab(customQrUrl ? 'custom' : 'dynamic');
                  setUpiModalVisible(true);
                }}
                disabled={collectPaymentMutation.isPending}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 py-3.5 active:scale-[0.98] disabled:opacity-60"
              >
                <Feather name="smartphone" size={15} color="#ffffff" />
                <Text className="text-[11px] font-black uppercase tracking-[1px] text-white">UPI QR</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      {/* Staff Assigned UPI QR Modal for this Order */}
      {upiModalVisible && (
        <View className="mt-4 rounded-[28px] bg-emerald-950 p-5 border border-emerald-700 shadow-lg items-center">
          <View className="w-full flex-row items-center justify-between pb-3 border-b border-emerald-800">
            <View>
              <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Scan & Pay via UPI</Text>
              <Text className="text-base font-black text-white">{task.orderNumber}</Text>
            </View>
            <Pressable onPress={() => setUpiModalVisible(false)} className="p-1">
              <Feather name="x-circle" size={20} color="#93C5FD" />
            </Pressable>
          </View>

          {/* Amount Badge */}
          <View className="my-3 rounded-2xl bg-emerald-900/80 px-6 py-2 border border-emerald-600">
            <Text className="text-2xl font-black text-white text-center">
              {currencyFormatter.format(task.totalAmount)}
            </Text>
          </View>

          {/* Tab Switcher if custom QR is uploaded */}
          {customQrUrl && (
            <View className="flex-row rounded-full bg-emerald-900/90 p-1 mb-2 border border-emerald-700 w-full">
              <Pressable
                onPress={() => setActiveQrTab('custom')}
                className={`flex-1 py-2 rounded-full items-center ${activeQrTab === 'custom' ? 'bg-emerald-500' : ''}`}
              >
                <Text className={`text-[10px] font-black uppercase tracking-wider ${activeQrTab === 'custom' ? 'text-emerald-950' : 'text-emerald-300'}`}>
                  Store QR Code
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveQrTab('dynamic')}
                className={`flex-1 py-2 rounded-full items-center ${activeQrTab === 'dynamic' ? 'bg-emerald-500' : ''}`}
              >
                <Text className={`text-[10px] font-black uppercase tracking-wider ${activeQrTab === 'dynamic' ? 'text-emerald-950' : 'text-emerald-300'}`}>
                  Amount QR
                </Text>
              </Pressable>
            </View>
          )}

          {/* QR Code Container */}
          <View className="p-4 rounded-3xl bg-white shadow-md my-2 items-center justify-center">
            {activeQrTab === 'custom' && customQrUrl ? (
              <Image
                source={{ uri: resolveMediaUrl(customQrUrl) }}
                style={{ width: 200, height: 200, borderRadius: 8 }}
                contentFit="contain"
              />
            ) : (
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    upiPaymentUri
                  )}`,
                }}
                style={{ width: 180, height: 180, borderRadius: 8 }}
                contentFit="contain"
              />
            )}
          </View>

          <Text className="text-xs font-bold text-emerald-200 mt-2 text-center">
            {staffUpiId ? `UPI ID: ${staffUpiId}` : `Staff: ${staff?.name || 'Store Staff'}`}
          </Text>
          <Text className="text-[10px] font-semibold text-emerald-400 text-center mt-0.5 mb-4">
            Customer can scan using GPay, PhonePe, Paytm, BHIM or any UPI app.
          </Text>

          {/* Confirm Payment Received */}
          <Pressable
            onPress={() => collectPaymentMutation.mutate('upi')}
            disabled={collectPaymentMutation.isPending}
            className="w-full rounded-2xl bg-emerald-500 py-3.5 items-center justify-center active:scale-95 shadow-md"
          >
            {collectPaymentMutation.isPending ? (
              <ActivityIndicator color="#064E3B" />
            ) : (
              <Text className="text-xs font-black uppercase tracking-wider text-emerald-950">
                Confirm UPI Payment Received ({currencyFormatter.format(task.totalAmount)})
              </Text>
            )}
          </Pressable>
        </View>
      )}

      <View className="mt-4 rounded-[24px] border border-primary-100 p-4">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-[10px] font-black uppercase tracking-[1.6px] text-primary-500">Pickup OTP</Text>
          <Pressable
            onPress={handleSendOtp}
            disabled={isSendingOtpCode}
            className="rounded-full bg-primary-900 px-3 py-1.5 active:scale-[0.97]"
          >
            {isSendingOtpCode ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="text-[9px] font-black uppercase tracking-[1px] text-white">Send OTP</Text>
            )}
          </Pressable>
        </View>
        <TextInput
          value={otp}
          onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
          placeholder="OTP"
          keyboardType="number-pad"
          maxLength={6}
          className="mt-3 rounded-[20px] bg-primary-50 px-4 py-4 text-center text-2xl font-black tracking-[8px] text-primary-900"
          placeholderTextColor="#7a978b"
        />
        <Pressable
          onPress={() => {
            if (!otp || otp.length < 4) {
              Alert.alert('OTP Required', 'Please enter the customer OTP to verify pickup.');
              return;
            }
            verifyMutation.mutate();
          }}
          disabled={verifyMutation.isPending}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-full bg-primary-900 px-4 py-4 disabled:opacity-60"
        >
          {verifyMutation.isPending ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : null}
          <Text className="text-center text-[10px] font-black uppercase tracking-[1px] text-white">
            {verifyMutation.isPending ? 'Verifying...' : 'Verify & Deliver'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function PickupScreen() {
  const { staff, token, hydrated, logout, setStaff } = useStaffAuthStore();
  const queryClient = useQueryClient();

  const pickupsQuery = useQuery({
    queryKey: ['dealer-staff-pickups'],
    queryFn: staffApi.pickupOrders,
    enabled: Boolean(token),
    refetchInterval: 15_000,
  });

  const sessionQuery = useQuery({
    queryKey: ['dealer-staff-session', token],
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

  const tasks = useMemo(() => pickupsQuery.data || [], [pickupsQuery.data]);
  // Filter tasks to only show non-delivered orders.
  // NOTE: this hook must stay above the early returns below, otherwise the
  // hook count changes between renders ("Rendered more hooks than during the
  // previous render") and the app crashes.
  const activePickups = useMemo(() => tasks.filter((t) => t.status !== 'delivered'), [tasks]);

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
          data={activePickups}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PickupCard task={item} />}
          estimatedItemSize={300}
          contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
          showsVerticalScrollIndicator={false}
          onRefresh={() => pickupsQuery.refetch()}
          refreshing={pickupsQuery.isRefetching}
          ListHeaderComponent={
            <View>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-[11px] font-black uppercase tracking-[2px] text-primary-500">Dealers Staff Panel</Text>
                  <Text className="mt-2 text-3xl font-black text-primary-900">{staff?.name || 'Staff'}</Text>
                  <Text className="mt-1 text-sm text-primary-900/60">{staff?.mobile}</Text>
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
                  <Text className="text-2xl font-black text-white">{activePickups.length}</Text>
                  <Text className="mt-1 text-[10px] font-black uppercase tracking-[1.5px] text-white/55">Active Pickups</Text>
                </View>
                <Pressable onPress={() => pickupsQuery.refetch()} className="w-24 items-center justify-center rounded-[24px] bg-white border border-primary-50">
                  <Feather name="refresh-cw" size={20} color="#143D2E" />
                  <Text className="mt-1 text-[10px] font-black uppercase tracking-[1px] text-primary-900">Refresh</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => router.push('/inventory' as never)}
                className="mt-3 flex-row items-center justify-between rounded-[24px] bg-white border border-primary-50 px-5 py-4 active:scale-[0.99]"
              >
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-50">
                    <Feather name="box" size={18} color="#2D6A4F" />
                  </View>
                  <View>
                    <Text className="text-sm font-black text-primary-900">Manage Inventory</Text>
                    <Text className="mt-0.5 text-[11px] font-semibold text-primary-900/55">Update store stock levels</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color="#143D2E" />
              </Pressable>

              <View className="h-5" />
            </View>
          }
          ListEmptyComponent={
            pickupsQuery.isLoading ? (
              <View className="rounded-[28px] bg-white p-8 border border-primary-50">
                <ActivityIndicator color="#2D6A4F" />
                <Text className="mt-4 text-center text-sm font-semibold text-primary-900/60">Loading pickup orders...</Text>
              </View>
            ) : (
              <View className="rounded-[28px] bg-white p-8 border border-primary-50">
                <Text className="text-center text-xl font-black text-primary-900">No active pickup orders.</Text>
                <Text className="mt-2 text-center text-sm leading-6 text-primary-900/60">
                  Orders chosen for store pickup will show up here automatically.
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
