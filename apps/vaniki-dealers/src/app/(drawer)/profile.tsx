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

const Icon = Feather as any;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setUser, clearSession } = useAdminAuthStore();

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

  const updateProfileMutation = useMutation({
    mutationFn: (payload: any) => adminApi.updateMe(payload),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      Alert.alert('Profile Saved! ✅', 'Your dealer store details have been updated.');
    },
    onError: (error: any) => {
      Alert.alert('Update Failed', error.message || 'Failed to update profile.');
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: (payload: any) => adminApi.changePassword(payload),
    onSuccess: () => {
      Alert.alert(
        'Password Changed ✅', 
        'Password updated successfully! Please log in again with your new credentials.',
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
      Alert.alert('Missing Name', 'Store / Owner name must not be empty.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit mobile number.');
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

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing Fields', 'All password fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.logout();
            } catch {}
            clearSession();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* ─── Profile Header ───────────────────────────────────────────────── */}
          <View className="rounded-3xl bg-[#143D2E] p-6 shadow-lg shadow-emerald-950/20">
            <View className="flex-row items-center gap-4">
              <View className="h-16 w-16 rounded-2xl bg-white/10 items-center justify-center border border-white/20">
                <Icon name="shield" size={28} color="#34d399" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-lg font-black text-white" numberOfLines={1}>
                    {user?.name || 'Agri Dealer'}
                  </Text>
                  <Icon name="check-circle" size={16} color="#34d399" />
                </View>
                <Text className="text-xs font-semibold text-emerald-300 mt-0.5">
                  {user?.mobile || '+91 - Authorized Dealer'}
                </Text>
                <View className="mt-2 self-start rounded-full bg-emerald-800/80 px-2.5 py-0.5">
                  <Text className="text-[9px] font-black uppercase tracking-wider text-emerald-200">
                    Certified Vaniki Center
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ─── Navigation Tabs ──────────────────────────────────────────────── */}
          <View className="mt-5 flex-row rounded-2xl bg-white p-1 border border-slate-100 shadow-xs">
            <TouchableOpacity
              onPress={() => setActiveTab('details')}
              className={`flex-1 py-2.5 rounded-xl items-center ${
                activeTab === 'details' ? 'bg-[#143D2E]' : 'bg-transparent'
              }`}
            >
              <Text className={`text-xs font-black uppercase tracking-wider ${
                activeTab === 'details' ? 'text-white' : 'text-slate-500'
              }`}>
                Store Details
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('security')}
              className={`flex-1 py-2.5 rounded-xl items-center ${
                activeTab === 'security' ? 'bg-[#143D2E]' : 'bg-transparent'
              }`}
            >
              <Text className={`text-xs font-black uppercase tracking-wider ${
                activeTab === 'security' ? 'text-white' : 'text-slate-500'
              }`}>
                Security & Login
              </Text>
            </TouchableOpacity>
          </View>

          {/* ─── Tab Content ──────────────────────────────────────────────────── */}
          {activeTab === 'details' ? (
            <View className="mt-5 space-y-4">
              <View className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
                <Text className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-4">
                  Owner & Store Profile
                </Text>

                <View className="space-y-3">
                  <View>
                    <Text className="text-[11px] font-bold text-slate-500 mb-1">Dealership / Owner Name</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                    />
                  </View>

                  <View>
                    <Text className="text-[11px] font-bold text-slate-500 mb-1">Registered Mobile</Text>
                    <TextInput
                      value={mobile}
                      onChangeText={setMobile}
                      keyboardType="phone-pad"
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                    />
                  </View>

                  <View>
                    <Text className="text-[11px] font-bold text-slate-500 mb-1">Email Address</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      placeholder="e.g. store@vanikicrop.com"
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                    />
                  </View>
                </View>
              </View>

              {/* Godown Address */}
              <View className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
                <Text className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-4">
                  Shop & Godown Address
                </Text>

                <View className="space-y-3">
                  <View>
                    <Text className="text-[11px] font-bold text-slate-500 mb-1">Street / Market Location</Text>
                    <TextInput
                      value={street}
                      onChangeText={setStreet}
                      placeholder="e.g. Main Krishi Mandi Road"
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                    />
                  </View>

                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className="text-[11px] font-bold text-slate-500 mb-1">City / Tehsil</Text>
                      <TextInput
                        value={city}
                        onChangeText={setCity}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[11px] font-bold text-slate-500 mb-1">PIN Code</Text>
                      <TextInput
                        value={pincode}
                        onChangeText={setPincode}
                        keyboardType="number-pad"
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                className="rounded-2xl bg-[#143D2E] py-4 items-center shadow-lg shadow-emerald-950/20 active:bg-emerald-900"
              >
                {updateProfileMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-xs font-black uppercase tracking-[1.5px] text-white">
                    Save Profile Changes
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View className="mt-5 space-y-4">
              <View className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
                <Text className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-4">
                  Change Access Password
                </Text>

                <View className="space-y-3">
                  <View>
                    <Text className="text-[11px] font-bold text-slate-500 mb-1">Current Password</Text>
                    <TextInput
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      secureTextEntry
                      placeholder="••••••••"
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                    />
                  </View>

                  <View>
                    <Text className="text-[11px] font-bold text-slate-500 mb-1">New Password</Text>
                    <TextInput
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      placeholder="••••••••"
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                    />
                  </View>

                  <View>
                    <Text className="text-[11px] font-bold text-slate-500 mb-1">Confirm New Password</Text>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      placeholder="••••••••"
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={changePasswordMutation.isPending}
                className="rounded-2xl bg-[#143D2E] py-4 items-center shadow-lg shadow-emerald-950/20 active:bg-emerald-900"
              >
                {changePasswordMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-xs font-black uppercase tracking-[1.5px] text-white">
                    Update Password
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ─── Sign Out Action ──────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.8}
            className="mt-8 flex-row items-center justify-center gap-2 rounded-2xl bg-rose-50 py-3.5 border border-rose-200 active:bg-rose-100"
          >
            <Icon name="log-out" size={16} color="#e11d48" />
            <Text className="text-xs font-black uppercase tracking-wider text-rose-700">
              Sign Out from Dealership
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
