import React, { useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../utils/api';
import { Feather } from '@expo/vector-icons';

const Icon = Feather as any;

export default function StaffScreen() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');

  // Fetch store staff
  const { data: staffList = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-staff-list'],
    queryFn: adminApi.listStoreStaff,
  });

  const createStaffMutation = useMutation({
    mutationFn: (payload: Record<string, string>) => adminApi.createStoreStaff(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff-list'] });
      setModalVisible(false);
      setName('');
      setMobile('');
      setPassword('');
      Alert.alert('Staff Added! ✅', 'New store employee account has been created.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create staff account.');
    }
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteStoreStaff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff-list'] });
      Alert.alert('Staff Removed', 'Staff account access has been revoked.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to remove staff.');
    }
  });

  const handleCreateStaff = () => {
    if (!name.trim() || !mobile.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'All fields (Name, Mobile, Password) are required.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      Alert.alert('Invalid Mobile', 'Enter a valid 10-digit mobile number.');
      return;
    }

    createStaffMutation.mutate({
      name: name.trim(),
      mobile: mobile.trim(),
      password: password.trim()
    });
  };

  const handleDeleteConfirm = (id: string, staffName: string) => {
    Alert.alert(
      'Revoke Staff Access',
      `Are you sure you want to remove ${staffName}? They will no longer be able to log in to this dealer account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => deleteStaffMutation.mutate(id)
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* ─── Header & Add Button ───────────────────────────────────────────── */}
      <View className="bg-white px-4 py-3.5 border-b border-slate-100 shadow-xs flex-row items-center justify-between">
        <View>
          <Text className="text-base font-black text-slate-900">Store Staff & Operators</Text>
          <Text className="text-xs font-semibold text-slate-400">
            {staffList.length} Active Employees
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}
          className="flex-row items-center gap-1.5 rounded-xl bg-[#143D2E] px-4 py-2.5 shadow-xs active:bg-emerald-900"
        >
          <Icon name="user-plus" size={14} color="#ffffff" />
          <Text className="text-xs font-black uppercase tracking-wider text-white">Add Staff</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Staff List ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#143D2E" />
          <Text className="mt-3 text-slate-400 font-bold text-xs">Loading staff accounts...</Text>
        </View>
      ) : (
        <FlatList
          data={staffList}
          keyExtractor={(item) => item.id || item._id}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={['#143D2E']} />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-6 rounded-3xl bg-white border border-dashed border-slate-200">
              <Icon name="users" size={40} color="#94a3b8" />
              <Text className="mt-4 font-black text-slate-800 text-base">No Staff Members</Text>
              <Text className="mt-1 text-center text-xs text-slate-400">
                Add store employees to give them billing & inventory access.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="mb-3.5 rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-xs flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 rounded-2xl bg-emerald-50 items-center justify-center border border-emerald-100">
                  <Icon name="user" size={18} color="#059669" />
                </View>
                <View>
                  <Text className="text-base font-black text-slate-900 leading-tight">
                    {item.name}
                  </Text>
                  <Text className="text-xs font-semibold text-slate-400 mt-0.5">
                    {item.mobile} · Store Operator
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => handleDeleteConfirm(item.id || item._id, item.name)}
                className="rounded-xl bg-rose-50 p-2.5 border border-rose-100 active:bg-rose-100"
              >
                <Icon name="trash-2" size={16} color="#e11d48" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* ─── Add Staff Modal ────────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-slate-950/60">
          <View className="rounded-t-[2.5rem] bg-white p-6 shadow-2xl">
            <View className="flex-row items-center justify-between pb-4 border-b border-slate-100">
              <View>
                <Text className="text-xs font-black uppercase tracking-[2px] text-emerald-800">
                  New Operator
                </Text>
                <Text className="text-lg font-black text-slate-900 mt-0.5">Add Store Staff</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="rounded-full bg-slate-100 p-2"
              >
                <Icon name="x" size={16} color="#475569" />
              </TouchableOpacity>
            </View>

            <View className="mt-5 space-y-3">
              <View>
                <Text className="text-[11px] font-bold text-slate-500 mb-1">Employee Full Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Ramesh Patel"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                />
              </View>

              <View>
                <Text className="text-[11px] font-bold text-slate-500 mb-1">Mobile Number (Login ID)</Text>
                <TextInput
                  value={mobile}
                  onChangeText={setMobile}
                  keyboardType="phone-pad"
                  placeholder="e.g. 9876543210"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                />
              </View>

              <View>
                <Text className="text-[11px] font-bold text-slate-500 mb-1">Account Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Minimum 6 characters"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                />
              </View>

              <TouchableOpacity
                onPress={handleCreateStaff}
                disabled={createStaffMutation.isPending}
                className="mt-4 rounded-2xl bg-[#143D2E] py-4 items-center shadow-lg shadow-emerald-950/20 active:bg-emerald-900"
              >
                {createStaffMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-xs font-black uppercase tracking-[1.5px] text-white">
                    Create Employee Account
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
