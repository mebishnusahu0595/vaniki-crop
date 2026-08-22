import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useAdminAuthStore } from '../../store/useAdminAuthStore';
import { adminApi } from '../../utils/api';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setUser, clearSession } = useAdminAuthStore();

  // Tab switching state between 'profile' and 'password'
  const [activeTab, setActiveTab] = useState<'details' | 'security'>('details');

  // Text inputs states
  const [name, setName] = useState(user?.name || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [email, setEmail] = useState(user?.email || '');

  // Address inputs states
  const [street, setStreet] = useState(user?.savedAddress?.street || '');
  const [city, setCity] = useState(user?.savedAddress?.city || '');
  const [state, setState] = useState(user?.savedAddress?.state || '');
  const [pincode, setPincode] = useState(user?.savedAddress?.pincode || '');
  const [landmark, setLandmark] = useState(user?.savedAddress?.landmark || '');

  // Password inputs states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: (payload: any) => adminApi.updateMe(payload),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      Alert.alert('Success', 'Profile settings updated successfully.');
    },
    onError: (error: any) => {
      Alert.alert('Update Failed', error.message || 'Failed to update profile settings.');
    }
  });

  // Password update mutation
  const changePasswordMutation = useMutation({
    mutationFn: (payload: any) => adminApi.changePassword(payload),
    onSuccess: () => {
      Alert.alert(
        'Password Changed', 
        'Password changed successfully! Please log in again with your new credentials.',
        [
          { 
            text: 'OK', 
            onPress: () => {
              clearSession();
              router.replace('/(auth)/login');
            } 
          }
        ]
      );
    },
    onError: (error: any) => {
      Alert.alert('Change Failed', error.message || 'Failed to change password.');
    }
  });

  const handleSaveProfile = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name must not be empty.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    const hasAddress = [street, city, state, pincode, landmark].some(v => v.trim().length > 0);

    const payload = {
      name: name.trim(),
      mobile: mobile.trim(),
      email: email.trim() || undefined,
      savedAddress: hasAddress ? {
        street: street.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        pincode: pincode.trim() || undefined,
        landmark: landmark.trim() || undefined,
      } : undefined
    };

    updateProfileMutation.mutate(payload);
  };

  const handleUpdatePassword = () => {
    if (!currentPassword || currentPassword.length < 6) {
      Alert.alert('Error', 'Current password must be at least 6 characters.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New password and confirm password must match.');
      return;
    }
    if (currentPassword === newPassword) {
      Alert.alert('Error', 'New password must be different from current password.');
      return;
    }

    changePasswordMutation.mutate({
      currentPassword,
      newPassword
    });
  };

  const initials = (user?.name || 'A').slice(0, 1).toUpperCase();

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Tab Selectors */}
        <View className="bg-white border-b border-zinc-100 shadow-sm flex-row px-6 pt-4 pb-1 gap-6">
          <TouchableOpacity 
            onPress={() => setActiveTab('details')}
            className={`pb-3 border-b-2 ${activeTab === 'details' ? 'border-emerald-700' : 'border-transparent'}`}
          >
            <Text className={`font-black text-sm uppercase tracking-wider ${activeTab === 'details' ? 'text-emerald-800' : 'text-zinc-400'}`}>
              Profile Info
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('security')}
            className={`pb-3 border-b-2 ${activeTab === 'security' ? 'border-emerald-700' : 'border-transparent'}`}
          >
            <Text className={`font-black text-sm uppercase tracking-wider ${activeTab === 'security' ? 'text-emerald-800' : 'text-zinc-400'}`}>
              Security & Password
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} className="flex-1">
          {activeTab === 'details' ? (
            <View className="space-y-6">
              {/* Profile Avatar Block */}
              <View className="bg-white border border-zinc-100 rounded-[2.2rem] p-5 shadow-sm flex-row items-center">
                <View className="h-16 w-16 bg-emerald-50 rounded-2xl items-center justify-center mr-4 border border-emerald-100">
                  <Text className="text-emerald-800 font-black text-2xl">{initials}</Text>
                </View>
                <View>
                  <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">Registered Role</Text>
                  <Text className="text-zinc-900 font-black text-base mt-0.5">Dealer Store Administrator</Text>
                </View>
              </View>

              {/* Text Fields */}
              <View className="bg-white border border-zinc-100 rounded-[2.2rem] p-5 shadow-sm space-y-4">
                <Text className="text-zinc-900 font-black text-base mb-2">Personal Details</Text>

                <View>
                  <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">Full Name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Dealer Name"
                    placeholderTextColor="#A1A1AA"
                    className="bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 px-4 text-zinc-900 font-bold text-sm h-12"
                  />
                </View>

                <View>
                  <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">Mobile Number</Text>
                  <TextInput
                    value={mobile}
                    onChangeText={setMobile}
                    placeholder="9876543210"
                    placeholderTextColor="#A1A1AA"
                    keyboardType="phone-pad"
                    className="bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 px-4 text-zinc-900 font-bold text-sm h-12"
                  />
                </View>

                <View>
                  <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">Email Address</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="dealer@example.com"
                    placeholderTextColor="#A1A1AA"
                    keyboardType="email-address"
                    className="bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 px-4 text-zinc-900 font-bold text-sm h-12"
                  />
                </View>
              </View>

              {/* Read Only GST Profile Data */}
              <View className="bg-white border border-zinc-100 rounded-[2.2rem] p-5 shadow-sm space-y-3">
                <Text className="text-zinc-900 font-black text-base mb-1">Company Credentials</Text>
                
                <View className="flex-row justify-between items-center bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
                  <View>
                    <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">GST Number</Text>
                    <Text className="text-zinc-800 font-black text-sm mt-0.5 font-mono">
                      {(user as any)?.dealerProfile?.gstNumber || '-'}
                    </Text>
                  </View>
                  <View className="border-l border-zinc-200 pl-4">
                    <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">SGST Number</Text>
                    <Text className="text-zinc-800 font-black text-sm mt-0.5 font-mono">
                      {(user as any)?.dealerProfile?.sgstNumber || '-'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Personal Address Blocks */}
              <View className="bg-white border border-zinc-100 rounded-[2.2rem] p-5 shadow-sm space-y-4">
                <Text className="text-zinc-900 font-black text-base mb-2">Personal Address</Text>

                <View>
                  <TextInput
                    value={street}
                    onChangeText={setStreet}
                    placeholder="Street Address"
                    placeholderTextColor="#A1A1AA"
                    className="bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 px-4 text-zinc-900 font-bold text-sm h-12"
                  />
                </View>

                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <TextInput
                      value={city}
                      onChangeText={setCity}
                      placeholder="City / District"
                      placeholderTextColor="#A1A1AA"
                      className="bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 px-4 text-zinc-900 font-bold text-sm h-12"
                    />
                  </View>
                  <View className="flex-1">
                    <TextInput
                      value={state}
                      onChangeText={setState}
                      placeholder="State"
                      placeholderTextColor="#A1A1AA"
                      className="bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 px-4 text-zinc-900 font-bold text-sm h-12"
                    />
                  </View>
                </View>

                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <TextInput
                      value={pincode}
                      onChangeText={setPincode}
                      placeholder="Pincode"
                      placeholderTextColor="#A1A1AA"
                      keyboardType="number-pad"
                      className="bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 px-4 text-zinc-900 font-bold text-sm h-12"
                    />
                  </View>
                  <View className="flex-1">
                    <TextInput
                      value={landmark}
                      onChangeText={setLandmark}
                      placeholder="Landmark"
                      placeholderTextColor="#A1A1AA"
                      className="bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 px-4 text-zinc-900 font-bold text-sm h-12"
                    />
                  </View>
                </View>
              </View>

              {/* Submit Trigger */}
              <TouchableOpacity
                onPress={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                className="w-full rounded-2xl bg-emerald-700 py-4 items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
              >
                {updateProfileMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-black text-xs uppercase tracking-[0.2em]">Save Profile Settings</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View className="space-y-6">
              {/* Security Panels */}
              <View className="bg-white border border-zinc-100 rounded-[2.2rem] p-5 shadow-sm space-y-4">
                <Text className="text-zinc-900 font-black text-base mb-2">Change Password</Text>

                <View>
                  <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">Current Password</Text>
                  <TextInput
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password..."
                    placeholderTextColor="#A1A1AA"
                    secureTextEntry
                    className="bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 px-4 text-zinc-900 font-bold text-sm h-12"
                  />
                </View>

                <View>
                  <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">New Password</Text>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password (min 6 chars)..."
                    placeholderTextColor="#A1A1AA"
                    secureTextEntry
                    className="bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 px-4 text-zinc-900 font-bold text-sm h-12"
                  />
                </View>

                <View>
                  <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">Confirm New Password</Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter new password..."
                    placeholderTextColor="#A1A1AA"
                    secureTextEntry
                    className="bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 px-4 text-zinc-900 font-bold text-sm h-12"
                  />
                </View>
              </View>

              {/* Password Trigger */}
              <TouchableOpacity
                onPress={handleUpdatePassword}
                disabled={changePasswordMutation.isPending}
                className="w-full rounded-2xl bg-emerald-700 py-4 items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
              >
                {changePasswordMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-black text-xs uppercase tracking-[0.2em]">Update Security Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
