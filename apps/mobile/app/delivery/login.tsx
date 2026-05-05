import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Screen } from '../../src/components/Screen';
import { staffApi } from '../../src/lib/staffApi';
import { useStaffAuthStore } from '../../src/store/useStaffAuthStore';

export default function DeliveryLoginScreen() {
  const isStaffApp = Constants.expoConfig?.extra?.appVariant === 'staff';
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const setSession = useStaffAuthStore((state) => state.setSession);

  const handleLogin = async () => {
    if (!/^[6-9]\d{9}$/.test(mobile) || password.length < 6) {
      Alert.alert('Missing details', 'Enter staff mobile number and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await staffApi.login({ mobile, password });
      setSession({ staff: response.staff, token: response.accessToken });
      router.replace('/delivery' as never);
    } catch (error) {
      Alert.alert('Login failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen withHeader={false} withServiceBar={false} withWhatsAppFab={false} scroll={false} keyboardAware={false}>
      <KeyboardAvoidingView
        className="flex-1 justify-center"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="rounded-[32px] bg-white p-8">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary-500">
            <Feather name="truck" size={24} color="#ffffff" />
          </View>
          <Text className="mt-5 text-[11px] font-black uppercase tracking-[2px] text-primary-500">Delivery Staff</Text>
          <Text className="mt-3 text-3xl font-black text-primary-900">Vaniki delivery app.</Text>
          <Text className="mt-3 text-sm leading-6 text-primary-900/65">
            Login to see assigned tasks, customer address, OTP, products, and delivery actions.
          </Text>

          <View className="mt-7">
            <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Mobile Number</Text>
            <TextInput
              value={mobile}
              onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
              placeholder="9876543210"
              keyboardType="number-pad"
              maxLength={10}
              className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
              placeholderTextColor="#7a978b"
            />
          </View>

          <View className="mt-5">
            <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Password</Text>
            <View className="relative">
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Password"
                className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 pr-12 text-base text-primary-900"
                placeholderTextColor="#7a978b"
              />
              <Pressable
                onPress={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -mt-3 h-6 w-6 items-center justify-center"
                hitSlop={8}
              >
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#527164" />
              </Pressable>
            </View>
          </View>

          <Pressable
            disabled={loading}
            onPress={handleLogin}
            className="mt-7 rounded-full bg-primary-900 px-5 py-4 disabled:opacity-60"
          >
            <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
              {loading ? 'Signing In...' : 'Login'}
            </Text>
          </Pressable>

          {!isStaffApp ? (
            <Pressable onPress={() => router.replace('/(auth)/login')} className="mt-5 py-2">
              <Text className="text-center text-[11px] font-black uppercase tracking-[2px] text-primary-500">
                Customer Login
              </Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
