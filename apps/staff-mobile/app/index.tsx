import { useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { staffApi, DELIVERY_CANCEL_REASONS, type DeliveryTask } from '../src/lib/staffApi';
import { useStaffAuthStore } from '../src/store/useStaffAuthStore';
import { currencyFormatter, formatStoreAddress } from '../src/utils/format';
import { resolveMediaUrl } from '../src/utils/media';
import { LoadingScreen } from '../src/components/LoadingScreen';
import * as Notifications from 'expo-notifications';

function taskAddress(task: DeliveryTask) {
  return task.shippingAddress || task.userId?.savedAddress;
}

function customerName(task: DeliveryTask) {
  return task.shippingAddress?.name || task.userId?.name || 'Customer';
}

function customerMobile(task: DeliveryTask) {
  return task.shippingAddress?.mobile || task.userId?.mobile || '-';
}

function TaskCard({ task }: { task: DeliveryTask }) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(task.deliveryProofDescription || '');
  const [otp, setOtp] = useState('');
  const [cancelReason, setCancelReason] = useState<(typeof DELIVERY_CANCEL_REASONS)[number]>('Customer not available');
  const [cancelNote, setCancelNote] = useState('');
  const [proofImage, setProofImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [isSendingOtpCode, setIsSendingOtpCode] = useState(false);

  const handleSendOtp = async () => {
    setIsSendingOtpCode(true);
    try {
      await staffApi.sendDeliveryOtp(task.id);
      Alert.alert('Success', 'OTP sent to customer mobile number.');
    } catch (error) {
      Alert.alert('Failed to send OTP', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSendingOtpCode(false);
    }
  };

  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: ['delivery-staff-tasks'] });

  const completeMutation = useMutation({
    mutationFn: () => staffApi.completeTask(task.id, { description }),
    onSuccess: invalidateTasks,
    onError: (error) => Alert.alert('Could not complete task', error instanceof Error ? error.message : 'Please try again.'),
  });

  const deliverMutation = useMutation({
    mutationFn: () => staffApi.deliverTask(task.id, { otp, description, proofImage: proofImage || undefined }),
    onSuccess: () => {
      setOtp('');
      setProofImage(null);
      invalidateTasks();
      Alert.alert('Delivered', 'Order marked as delivered.');
    },
    onError: (error) => Alert.alert('Delivery failed', error instanceof Error ? error.message : 'Please check OTP and try again.'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => staffApi.cancelTask(task.id, { reason: cancelReason, note: cancelNote }),
    onSuccess: invalidateTasks,
    onError: (error) => Alert.alert('Cancel failed', error instanceof Error ? error.message : 'Please try again.'),
  });

  const collectPaymentMutation = useMutation({
    mutationFn: (method: 'cash' | 'upi') => staffApi.collectPayment(task.id, { method }),
    onSuccess: (_data, method) => {
      invalidateTasks();
      Alert.alert('Payment Recorded', `Marked as paid via ${method.toUpperCase()}.`);
    },
    onError: (error) => Alert.alert('Could not record payment', error instanceof Error ? error.message : 'Please try again.'),
  });

  const isPaid = task.paymentStatus === 'paid';
  const staff = useStaffAuthStore((state) => state.staff);
  const [upiModalVisible, setUpiModalVisible] = useState(false);

  const staffUpiId = staff?.upiId || `${staff?.mobile || 'delivery'}@upi`;
  const upiPaymentUri = `upi://pay?pa=${staffUpiId}&pn=${encodeURIComponent(
    staff?.name || 'Vaniki Delivery'
  )}&am=${task.totalAmount}&cu=INR&tn=Order_${task.orderNumber}`;

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

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload delivery proof.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const fileName = asset.fileName || `delivery-proof-${Date.now()}.jpg`;
    setProofImage({
      uri: asset.uri,
      name: fileName,
      type: asset.mimeType || 'image/jpeg',
    });
  };

  const address = taskAddress(task);

  return (
    <View className="rounded-[28px] bg-white p-5">
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

      {address ? (
        <View className="mt-4 rounded-[22px] bg-primary-50 p-4">
          <Text className="text-[10px] font-black uppercase tracking-[1.4px] text-primary-500">Delivery Address</Text>
          <Text className="mt-1 text-sm font-bold text-primary-900 leading-relaxed">{formatStoreAddress(address)}</Text>
        </View>
      ) : null}

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

              <Pressable
                onPress={() => setUpiModalVisible(true)}
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

          <View className="my-3 rounded-2xl bg-emerald-900/80 px-6 py-2 border border-emerald-600">
            <Text className="text-2xl font-black text-white text-center">
              {currencyFormatter.format(task.totalAmount)}
            </Text>
          </View>

          <View className="p-4 rounded-3xl bg-white shadow-md my-2 items-center justify-center">
            <Image
              source={{
                uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                  upiPaymentUri
                )}`,
              }}
              style={{ width: 180, height: 180, borderRadius: 8 }}
              contentFit="contain"
            />
          </View>

          <Text className="text-xs font-bold text-emerald-200 mt-2 text-center">
            UPI ID: <Text className="font-black text-white">{staffUpiId}</Text>
          </Text>
          <Text className="text-[10px] font-semibold text-emerald-400 text-center mt-0.5 mb-4">
            Customer can scan using GPay, PhonePe, Paytm, BHIM or any UPI app.
          </Text>

          <Pressable
            onPress={() => {
              collectPaymentMutation.mutate('upi');
              setUpiModalVisible(false);
            }}
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

      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Delivery description / note"
        multiline
        className="mt-4 min-h-[90px] rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
        placeholderTextColor="#7a978b"
      />

      <View className="mt-4 flex-row gap-3">
        <Pressable onPress={pickImage} className="flex-1 flex-row items-center justify-center gap-2 rounded-full border border-primary-100 bg-white px-4 py-4">
          <Feather name="image" size={16} color="#143D2E" />
          <Text className="text-[10px] font-black uppercase tracking-[1px] text-primary-900">
            {proofImage ? 'Change Image' : 'Upload Image'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => completeMutation.mutate()}
          disabled={completeMutation.isPending}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary-500 px-4 py-4 disabled:opacity-60"
        >
          {completeMutation.isPending ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : null}
          <Text className="text-center text-[10px] font-black uppercase tracking-[1px] text-white">
            {completeMutation.isPending ? 'Saving...' : 'Complete'}
          </Text>
        </Pressable>
      </View>

      {proofImage ? (
        <Image source={{ uri: proofImage.uri }} style={{ width: '100%', height: 160, borderRadius: 22, marginTop: 16 }} />
      ) : null}

      <View className="mt-5 rounded-[24px] border border-primary-100 p-4">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-[10px] font-black uppercase tracking-[1.6px] text-primary-500">Deliver With OTP</Text>
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
              Alert.alert('OTP Required', 'Please enter the customer OTP (min 4 digits) to complete delivery.');
              return;
            }
            deliverMutation.mutate();
          }}
          disabled={deliverMutation.isPending}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-full bg-primary-900 px-4 py-4 disabled:opacity-60"
        >
          {deliverMutation.isPending ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : null}
          <Text className="text-center text-[10px] font-black uppercase tracking-[1px] text-white">
            {deliverMutation.isPending ? 'Delivering...' : 'Mark Delivered'}
          </Text>
        </Pressable>
      </View>

      <View className="mt-5 rounded-[24px] border border-red-100 bg-red-50/40 p-4">
        <Text className="text-[10px] font-black uppercase tracking-[1.6px] text-red-600">Cancel Order</Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {DELIVERY_CANCEL_REASONS.map((reason) => (
            <Pressable
              key={reason}
              onPress={() => setCancelReason(reason)}
              className={`rounded-full px-3 py-2 ${cancelReason === reason ? 'bg-red-600' : 'bg-white'}`}
            >
              <Text className={`text-[10px] font-black uppercase tracking-[0.8px] ${cancelReason === reason ? 'text-white' : 'text-red-700'}`}>
                {reason}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={cancelNote}
          onChangeText={setCancelNote}
          placeholder="Optional cancellation note"
          className="mt-3 rounded-[20px] bg-white px-4 py-4 text-base text-primary-900"
          placeholderTextColor="#9f7777"
        />
        <Pressable
          onPress={() => {
            Alert.alert('Cancel order?', `Reason: ${cancelReason}`, [
              { text: 'Back', style: 'cancel' },
              { text: 'Cancel Order', style: 'destructive', onPress: () => cancelMutation.mutate() },
            ]);
          }}
          disabled={cancelMutation.isPending}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-4 disabled:opacity-60"
        >
          {cancelMutation.isPending ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : null}
          <Text className="text-center text-[10px] font-black uppercase tracking-[1px] text-white">
            {cancelMutation.isPending ? 'Sending...' : 'Send Cancellation'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function DeliveryTasksScreen() {
  const { staff, token, hydrated, logout, setStaff } = useStaffAuthStore();
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: ['delivery-staff-tasks'],
    queryFn: staffApi.tasks,
    enabled: Boolean(token),
    refetchInterval: 15_000,
  });

  const sessionQuery = useQuery({
    queryKey: ['delivery-staff-session', token],
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

  const tasks = useMemo(() => tasksQuery.data || [], [tasksQuery.data]);

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
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TaskCard task={item} />}
          estimatedItemSize={400}
          contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
          showsVerticalScrollIndicator={false}
          onRefresh={() => tasksQuery.refetch()}
          refreshing={tasksQuery.isRefetching}
          ListHeaderComponent={
            <View>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-[11px] font-black uppercase tracking-[2px] text-primary-500">Delivery Panel</Text>
                  <Text className="mt-2 text-3xl font-black text-primary-900">{staff?.name || 'Staff'}</Text>
                  <Text className="mt-1 text-sm text-primary-900/60">{staff?.mobile}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    logout();
                    router.replace('/login' as never);
                  }}
                  className="h-12 w-12 items-center justify-center rounded-full bg-white"
                >
                  <Feather name="log-out" size={20} color="#DC2626" />
                </Pressable>
              </View>

              <View className="mt-5 flex-row gap-3">
                <View className="flex-1 rounded-[24px] bg-primary-900 p-4">
                  <Text className="text-2xl font-black text-white">{tasks.length}</Text>
                  <Text className="mt-1 text-[10px] font-black uppercase tracking-[1.5px] text-white/55">Active Tasks</Text>
                </View>
                <Pressable onPress={() => tasksQuery.refetch()} className="w-24 items-center justify-center rounded-[24px] bg-white">
                  <Feather name="refresh-cw" size={20} color="#143D2E" />
                  <Text className="mt-1 text-[10px] font-black uppercase tracking-[1px] text-primary-900">Refresh</Text>
                </Pressable>
              </View>
              
              <View className="h-5" />
            </View>
          }
          ListEmptyComponent={
            tasksQuery.isLoading ? (
              <View className="rounded-[28px] bg-white p-8">
                <ActivityIndicator color="#2D6A4F" />
                <Text className="mt-4 text-center text-sm font-semibold text-primary-900/60">Loading tasks...</Text>
              </View>
            ) : (
              <View className="rounded-[28px] bg-white p-8">
                <Text className="text-center text-xl font-black text-primary-900">No active deliveries.</Text>
                <Text className="mt-2 text-center text-sm leading-6 text-primary-900/60">
                  New tasks assigned from superadmin will appear here automatically.
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
