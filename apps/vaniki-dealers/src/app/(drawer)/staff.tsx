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
  Alert
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../utils/api';
import { Feather } from '@expo/vector-icons';

const Icon = Feather as any;

export default function StaffScreen() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  
  // Add Staff form state
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');

  // Fetch store staff
  const { data: staffList = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-staff-list'],
    queryFn: adminApi.listStoreStaff,
  });

  // Create Staff mutation
  const createStaffMutation = useMutation({
    mutationFn: (payload: Record<string, string>) => adminApi.createStoreStaff(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff-list'] });
      setModalVisible(false);
      setName('');
      setMobile('');
      setPassword('');
      Alert.alert('Success', 'Staff member created successfully.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create staff member.');
    }
  });

  // Delete Staff mutation
  const deleteStaffMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteStoreStaff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff-list'] });
      Alert.alert('Deleted', 'Staff member has been removed.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to delete staff.');
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
      'Remove Staff',
      `Are you sure you want to remove ${staffName}?`,
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
    <SafeAreaView className="flex-1 bg-zinc-50">
      
      {/* Header Controls */}
      <View className="bg-white px-6 py-4 flex-row justify-between items-center border-b border-zinc-100 shadow-sm">
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="flex-row items-center bg-emerald-700 px-4 py-2.5 rounded-xl active:scale-95"
        >
          <Icon name="plus" size={16} color="#fff" />
          <Text className="text-white font-bold text-xs uppercase tracking-wider ml-2">
            Add New Staff
          </Text>
        </TouchableOpacity>

        <Text className="text-zinc-400 font-bold text-xs">
          {staffList.length} Active Staff
        </Text>
      </View>

      {/* Staff List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#143D2E" />
          <Text className="mt-3 text-zinc-400 font-bold">Loading store staff...</Text>
        </View>
      ) : (
        <FlatList
          data={staffList}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl 
              refreshing={isFetching} 
              onRefresh={refetch} 
              colors={['#143D2E']} 
            />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center py-20">
              <Icon name="users" size={48} color="#D4D4D8" />
              <Text className="text-zinc-500 font-black mt-4 uppercase tracking-widest text-xs">No Staff Members Found</Text>
              <Text className="text-zinc-400 text-xs mt-1 text-center px-6">Create staff accounts to let them log in and verify store pickup orders.</Text>
            </View>
          }
          renderItem={({ item: staff }) => (
            <View className="flex-row items-center justify-between border border-zinc-100 bg-white rounded-[2rem] p-5 mb-4 shadow-sm">
              <View className="flex-1 min-w-0 pr-4">
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-zinc-900 font-black text-base">{staff.name}</Text>
                  <Text className="bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-200">
                    Dealer Staff
                  </Text>
                </View>
                <Text className="text-xs text-zinc-500 font-bold mt-1">
                  Mobile: {staff.mobile}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handleDeleteConfirm(staff.id, staff.name)}
                className="bg-red-50 p-3 rounded-full active:scale-95 border border-red-100"
              >
                <Icon name="trash-2" size={16} color="#DC2626" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Add Staff Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-[2.5rem] p-6 shadow-2xl">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-zinc-950 font-black text-lg">Create Dealer Staff</Text>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                className="bg-zinc-100 p-2 rounded-full"
              >
                <Icon name="x" size={18} color="#3F3F46" />
              </TouchableOpacity>
            </View>

            {/* Inputs */}
            <View className="space-y-4 mb-6">
              <View>
                <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 ml-1">Staff Name</Text>
                <TextInput
                  placeholder="Enter full name"
                  value={name}
                  onChangeText={setName}
                  className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 text-sm"
                />
              </View>

              <View>
                <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 ml-1">Mobile Number</Text>
                <TextInput
                  placeholder="10-digit mobile number"
                  keyboardType="phone-pad"
                  value={mobile}
                  onChangeText={setMobile}
                  maxLength={10}
                  className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 text-sm"
                />
              </View>

              <View>
                <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 ml-1">Login Password</Text>
                <TextInput
                  placeholder="At least 6 characters"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 text-sm"
                />
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleCreateStaff}
              disabled={createStaffMutation.isPending}
              className="w-full rounded-2xl bg-emerald-700 py-4 items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
            >
              {createStaffMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-black text-xs uppercase tracking-[0.2em]">Create Staff Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
