import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/store/useAuthStore';
import { storefrontApi } from '../../src/lib/api';

export default function ChangePasswordScreen() {
  const { logout } = useAuthStore();
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleChangePassword = async () => {
    if (!password.currentPassword || !password.newPassword) {
      Alert.alert('Missing Info', 'Please fill in both current and new password.');
      return;
    }
    if (password.newPassword.length < 6) {
      Alert.alert('Invalid Password', 'New password must be at least 6 characters.');
      return;
    }

    setIsSaving(true);
    try {
      await storefrontApi.changePassword(password);
      Alert.alert('Success', 'Password changed successfully. Please login again.');
      await storefrontApi.logout().catch(() => undefined);
      logout();
      router.replace('/(auth)/login');
    } catch (caughtError) {
      Alert.alert('Change failed', caughtError instanceof Error ? caughtError.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Back and Title */}
        <View className="flex-row items-center gap-3 mb-6">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-primary-50 active:scale-90">
            <Feather name="arrow-left" size={18} color="#082018" />
          </Pressable>
          <Text className="text-2xl font-black text-primary-900">Security</Text>
        </View>

        {/* Password Form */}
        <View className="rounded-[28px] bg-white border border-primary-100 p-5 shadow-sm gap-4 mb-6">
          <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500 mb-1">Update Password</Text>

          <View>
            <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Current Password</Text>
            <View className="relative">
              <TextInput
                value={password.currentPassword}
                onChangeText={(value) => setPassword((current) => ({ ...current, currentPassword: value }))}
                placeholder="Current Password"
                secureTextEntry={!showCurrent}
                className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900 pr-12"
                placeholderTextColor="#7a978b"
              />
              <Pressable
                onPress={() => setShowCurrent(!showCurrent)}
                className="absolute right-4 top-1/2 -mt-3 h-6 w-6 items-center justify-center"
                hitSlop={8}
              >
                <Feather name={showCurrent ? 'eye-off' : 'eye'} size={18} color="#527164" />
              </Pressable>
            </View>
          </View>

          <View>
            <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">New Password</Text>
            <View className="relative">
              <TextInput
                value={password.newPassword}
                onChangeText={(value) => setPassword((current) => ({ ...current, newPassword: value }))}
                placeholder="New Password (Min 6 characters)"
                secureTextEntry={!showNew}
                className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900 pr-12"
                placeholderTextColor="#7a978b"
              />
              <Pressable
                onPress={() => setShowNew(!showNew)}
                className="absolute right-4 top-1/2 -mt-3 h-6 w-6 items-center justify-center"
                hitSlop={8}
              >
                <Feather name={showNew ? 'eye-off' : 'eye'} size={18} color="#527164" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <Pressable
          onPress={handleChangePassword}
          disabled={isSaving}
          className="rounded-full bg-primary-500 py-4 active:scale-95 shadow-sm"
          style={{ opacity: isSaving ? 0.6 : 1 }}
        >
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
            {isSaving ? 'Updating...' : 'Change Password'}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
