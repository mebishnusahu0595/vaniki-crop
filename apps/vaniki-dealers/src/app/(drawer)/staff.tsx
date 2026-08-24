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
  Image,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../utils/api';
import { Feather } from '@expo/vector-icons';

const Icon = Feather as any;

export default function StaffScreen() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [selectedStaffQr, setSelectedStaffQr] = useState<{ name: string; upiId: string; mobile: string } | null>(null);
  
  // Edit mode vs Create mode
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [upiId, setUpiId] = useState('');

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
      resetForm();
      Alert.alert('Success', 'Staff member created successfully with assigned payment QR.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create staff member.');
    }
  });

  // Update Staff mutation
  const updateStaffMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, any> }) => adminApi.updateStoreStaff(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff-list'] });
      resetForm();
      Alert.alert('Success', 'Staff member updated successfully.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update staff member.');
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

  const resetForm = () => {
    setModalVisible(false);
    setEditingStaffId(null);
    setName('');
    setMobile('');
    setPassword('');
    setUpiId('');
  };

  const handleOpenCreate = () => {
    setEditingStaffId(null);
    setName('');
    setMobile('');
    setPassword('');
    setUpiId('');
    setModalVisible(true);
  };

  const handleOpenEdit = (staff: any) => {
    setEditingStaffId(staff.id || staff._id);
    setName(staff.name || '');
    setMobile(staff.mobile || '');
    setPassword('');
    setUpiId(staff.upiId || '');
    setModalVisible(true);
  };

  const handleSaveStaff = () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter the staff member name.');
      return;
    }

    if (!editingStaffId) {
      if (!mobile.trim() || !password.trim()) {
        Alert.alert('Missing Fields', 'Mobile number and password are required for new staff.');
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
        password: password.trim(),
        upiId: upiId.trim(),
      });
    } else {
      const payload: Record<string, any> = {
        name: name.trim(),
        upiId: upiId.trim(),
      };
      if (password.trim() && password.length >= 6) {
        payload.password = password.trim();
      }
      updateStaffMutation.mutate({ id: editingStaffId, payload });
    }
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

  const openStaffQrModal = (staff: any) => {
    setSelectedStaffQr({
      name: staff.name,
      upiId: staff.upiId || `${staff.mobile}@upi`,
      mobile: staff.mobile,
    });
    setQrModalVisible(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      
      {/* Header Controls */}
      <View className="bg-white px-6 py-4 flex-row justify-between items-center border-b border-zinc-100 shadow-sm">
        <TouchableOpacity
          onPress={handleOpenCreate}
          className="flex-row items-center bg-emerald-700 px-4 py-2.5 rounded-xl active:scale-95 shadow-sm"
        >
          <Icon name="user-plus" size={16} color="#fff" />
          <Text className="text-white font-bold text-xs uppercase tracking-wider ml-2">
            Add New Staff
          </Text>
        </TouchableOpacity>

        <Text className="text-zinc-400 font-bold text-xs">
          {staffList.length} Staff Members
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
          keyExtractor={(item) => item.id || item._id}
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
              <Text className="text-zinc-400 text-xs mt-1 text-center px-6">
                Create staff accounts with UPI IDs so they can take payments via UPI QR and cash upon delivery.
              </Text>
            </View>
          }
          renderItem={({ item: staff }) => {
            const hasUpi = Boolean(staff.upiId);
            return (
              <View className="border border-zinc-100 bg-white rounded-[2rem] p-5 mb-4 shadow-sm">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 min-w-0 pr-3">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-zinc-900 font-black text-base">{staff.name}</Text>
                      <Text className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-emerald-200">
                        Staff
                      </Text>
                    </View>
                    <Text className="text-xs text-zinc-500 font-bold mt-1">
                      📞 Mobile: {staff.mobile}
                    </Text>

                    {/* Assigned UPI Badge */}
                    <View className="mt-2.5 flex-row items-center gap-1.5">
                      <View className={`rounded-lg px-2.5 py-1 flex-row items-center gap-1 border ${
                        hasUpi ? 'bg-primary-50 border-primary-100' : 'bg-amber-50 border-amber-100'
                      }`}>
                        <Icon name={hasUpi ? 'smartphone' : 'alert-circle'} size={12} color={hasUpi ? '#2D6A4F' : '#D97706'} />
                        <Text className={`text-[11px] font-black ${
                          hasUpi ? 'text-primary-800' : 'text-amber-800'
                        }`}>
                          {hasUpi ? `UPI: ${staff.upiId}` : 'No UPI ID assigned'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                      onPress={() => handleOpenEdit(staff)}
                      className="bg-zinc-100 p-2.5 rounded-full active:scale-95"
                    >
                      <Icon name="edit-2" size={15} color="#3F3F46" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteConfirm(staff.id || staff._id, staff.name)}
                      className="bg-red-50 p-2.5 rounded-full active:scale-95 border border-red-100"
                    >
                      <Icon name="trash-2" size={15} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* QR Code Action Footer */}
                <View className="mt-4 pt-3 border-t border-zinc-100 flex-row items-center justify-between">
                  <Text className="text-[10px] font-bold text-zinc-400">
                    Payment QR & Collection
                  </Text>
                  <TouchableOpacity
                    onPress={() => openStaffQrModal(staff)}
                    className="flex-row items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 active:scale-95"
                  >
                    <Icon name="qr-code" size={14} color="#065F46" />
                    <Text className="text-xs font-black text-emerald-800">
                      View Staff QR
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Add / Edit Staff Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={resetForm}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-[2.5rem] p-6 shadow-2xl max-h-[90%]">
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Modal Header */}
              <View className="flex-row justify-between items-center mb-5">
                <Text className="text-zinc-950 font-black text-lg">
                  {editingStaffId ? 'Edit Staff & QR Details' : 'Add New Staff & Assign QR'}
                </Text>
                <TouchableOpacity 
                  onPress={resetForm}
                  className="bg-zinc-100 p-2 rounded-full"
                >
                  <Icon name="x" size={18} color="#3F3F46" />
                </TouchableOpacity>
              </View>

              {/* Inputs */}
              <View className="space-y-4 mb-6">
                <View>
                  <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 ml-1">Staff Full Name *</Text>
                  <TextInput
                    placeholder="Enter staff full name"
                    value={name}
                    onChangeText={setName}
                    className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 text-sm font-bold"
                  />
                </View>

                {!editingStaffId && (
                  <View>
                    <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 ml-1">Mobile Number *</Text>
                    <TextInput
                      placeholder="10-digit mobile number"
                      keyboardType="phone-pad"
                      value={mobile}
                      onChangeText={setMobile}
                      maxLength={10}
                      className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 text-sm font-bold"
                    />
                  </View>
                )}

                <View>
                  <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 ml-1">
                    {editingStaffId ? 'New Password (Optional)' : 'Login Password *'}
                  </Text>
                  <TextInput
                    placeholder={editingStaffId ? 'Leave blank to keep unchanged' : 'At least 6 characters'}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 text-sm font-bold"
                  />
                </View>

                {/* Assigned UPI ID for QR Payments */}
                <View>
                  <View className="flex-row items-center justify-between mb-1 ml-1">
                    <Text className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
                      Assigned UPI ID (For In-Person QR Payments)
                    </Text>
                  </View>
                  <TextInput
                    placeholder="e.g. yourstore@okaxis or 9876543210@upi"
                    value={upiId}
                    onChangeText={setUpiId}
                    autoCapitalize="none"
                    className="bg-emerald-50/50 border-2 border-emerald-300 rounded-xl px-4 py-3 text-zinc-900 text-sm font-black"
                  />
                  <Text className="text-[10px] font-semibold text-zinc-400 mt-1 ml-1">
                    When this staff delivers/takes an order, this UPI QR will be displayed to customer for instant payment.
                  </Text>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSaveStaff}
                disabled={createStaffMutation.isPending || updateStaffMutation.isPending}
                className="w-full rounded-2xl bg-emerald-700 py-4 items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
              >
                {createStaffMutation.isPending || updateStaffMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-black text-xs uppercase tracking-[0.2em]">
                    {editingStaffId ? 'Update Staff Details' : 'Create Staff Account'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Staff QR Code View Modal */}
      <Modal
        visible={qrModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/75 p-5">
          <View className="bg-white rounded-[2.5rem] p-6 w-full max-w-sm items-center shadow-2xl border border-emerald-100">
            <View className="w-12 h-12 rounded-2xl bg-emerald-50 items-center justify-center mb-2">
              <Icon name="smartphone" size={24} color="#065F46" />
            </View>
            <Text className="text-lg font-black text-zinc-900 text-center">
              {selectedStaffQr?.name}
            </Text>
            <Text className="text-xs font-bold text-emerald-700 mt-0.5 text-center">
              Official Staff Payment QR
            </Text>

            {/* Generated UPI QR Image */}
            <View className="my-5 p-4 rounded-3xl bg-white border-2 border-dashed border-emerald-300 shadow-sm items-center justify-center">
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    `upi://pay?pa=${selectedStaffQr?.upiId}&pn=${encodeURIComponent(selectedStaffQr?.name || 'Vaniki Staff')}&cu=INR`
                  )}`,
                }}
                style={{ width: 200, height: 200, borderRadius: 12 }}
                resizeMode="contain"
              />
            </View>

            <View className="w-full bg-zinc-50 rounded-2xl p-3 items-center border border-zinc-100 mb-5">
              <Text className="text-[10px] font-bold text-zinc-400 uppercase">Assigned UPI ID</Text>
              <Text className="text-sm font-black text-zinc-800 mt-0.5" numberOfLines={1}>
                {selectedStaffQr?.upiId}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setQrModalVisible(false)}
              className="w-full bg-zinc-900 py-3.5 rounded-2xl items-center active:scale-95"
            >
              <Text className="text-white font-black text-xs uppercase tracking-wider">
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
