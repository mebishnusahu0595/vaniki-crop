import { useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { staffApi, DELIVERY_CANCEL_REASONS, type DeliveryTask } from '../../src/lib/staffApi';
import { useStaffAuthStore } from '../../src/store/useStaffAuthStore';
import { currencyFormatter, formatStoreAddress } from '../../src/utils/format';
import { resolveMediaUrl } from '../../src/utils/media';

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

      <View className="mt-4 rounded-[22px] bg-primary-50 p-4">
        <Text className="text-[10px] font-black uppercase tracking-[1.6px] text-primary-500">Delivery Address</Text>
        <Text className="mt-2 text-sm leading-6 text-primary-900">
          {address ? formatStoreAddress(address) : 'Address not available'}
        </Text>
      </View>

      <View className="mt-4 gap-3">
        {task.items.map((item, index) => (
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
          <Text className="mt-1 text-base font-black text-primary-900">{task.paymentMethod.toUpperCase()} · {task.paymentStatus}</Text>
        </View>
      </View>

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
        <Text className="text-[10px] font-black uppercase tracking-[1.6px] text-primary-500">Deliver With OTP</Text>
        <TextInput
          value={otp}
          onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Enter customer OTP"
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

  const tasks = useMemo(() => tasksQuery.data || [], [tasksQuery.data]);

  if (hydrated && !token) {
    router.replace('/delivery/login' as never);
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={tasksQuery.isRefetching} onRefresh={() => tasksQuery.refetch()} />}
      >
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[11px] font-black uppercase tracking-[2px] text-primary-500">Delivery Panel</Text>
            <Text className="mt-2 text-3xl font-black text-primary-900">{staff?.name || 'Staff'}</Text>
            <Text className="mt-1 text-sm text-primary-900/60">{staff?.mobile}</Text>
          </View>
          <Pressable
            onPress={() => {
              logout();
              router.replace('/delivery/login' as never);
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

        <View className="mt-5 gap-5">
          {tasksQuery.isLoading ? (
            <View className="rounded-[28px] bg-white p-8">
              <Text className="text-center text-sm font-semibold text-primary-900/60">Loading tasks...</Text>
            </View>
          ) : tasks.length === 0 ? (
            <View className="rounded-[28px] bg-white p-8">
              <Text className="text-center text-xl font-black text-primary-900">No active deliveries.</Text>
              <Text className="mt-2 text-center text-sm leading-6 text-primary-900/60">
                New tasks assigned from superadmin will appear here automatically.
              </Text>
            </View>
          ) : (
            tasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
