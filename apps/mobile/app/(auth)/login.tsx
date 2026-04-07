import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Screen } from '../../src/components/Screen';
import { storefrontApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function LoginScreen() {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const { setSession, token, enableBiometrics } = useAuthStore();

  return (
    <Screen withServiceBar={false}>
      <View className="mt-10 rounded-[32px] bg-white p-8">
        <Text className="text-[11px] font-black uppercase tracking-[2px] text-primary-400">Mobile Login</Text>
        <Text className="mt-3 text-3xl font-black text-primary-900">Welcome back to Vaniki Crop.</Text>
        <Text className="mt-4 text-sm leading-7 text-primary-900/70">
          Enter your mobile number to get an OTP, or use password login if you prefer.
        </Text>

        <TextInput
          value={mobile}
          onChangeText={setMobile}
          placeholder="Mobile Number"
          keyboardType="number-pad"
          className="mt-6 rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
          placeholderTextColor="#7a978b"
        />

        <Pressable
          disabled={loading}
          onPress={async () => {
            setLoading(true);
            try {
              await storefrontApi.sendOtp(mobile);
              router.push({ pathname: '/(auth)/otp-verify', params: { flow: 'login', mobile } });
            } catch (caughtError) {
              Alert.alert('OTP failed', caughtError instanceof Error ? caughtError.message : 'Try again.');
            } finally {
              setLoading(false);
            }
          }}
          className="mt-5 rounded-full bg-primary-500 px-5 py-4"
        >
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
            {loading ? 'Sending OTP...' : 'Get OTP'}
          </Text>
        </Pressable>

        <Pressable onPress={() => setShowPasswordLogin((current) => !current)} className="mt-4 py-2">
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">
            {showPasswordLogin ? 'Hide Password Login' : 'Use Password Instead'}
          </Text>
        </Pressable>

        {showPasswordLogin ? (
          <View className="mt-3 gap-3">
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password"
              className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
              placeholderTextColor="#7a978b"
            />
            <Pressable
              onPress={async () => {
                try {
                  const response = await storefrontApi.login({ mobile, password });
                  setSession({ user: response.user, token: response.accessToken });
                  await enableBiometrics();
                  router.replace('/(tabs)');
                } catch (caughtError) {
                  Alert.alert('Login failed', caughtError instanceof Error ? caughtError.message : 'Try again.');
                }
              }}
              className="rounded-full bg-primary-900 px-5 py-4"
            >
              <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">Login with Password</Text>
            </Pressable>
          </View>
        ) : null}

        {token ? (
          <Pressable
            onPress={async () => {
              const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Unlock Vaniki Crop',
              });
              if (result.success) {
                router.replace('/(tabs)');
              }
            }}
            className="mt-4 rounded-full bg-primary-50 px-5 py-4"
          >
            <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">
              Use Biometrics
            </Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.push('/(auth)/signup')} className="mt-6 py-2">
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">
            Create Account
          </Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            if (!mobile) {
              Alert.alert('Enter mobile number', 'Add your mobile number first to reset your password.');
              return;
            }
            try {
              await storefrontApi.forgotPassword(mobile);
              router.push({ pathname: '/(auth)/otp-verify', params: { flow: 'reset', mobile } });
            } catch (caughtError) {
              Alert.alert('Reset failed', caughtError instanceof Error ? caughtError.message : 'Try again.');
            }
          }}
          className="mt-2 py-2"
        >
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-400">
            Forgot Password
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
